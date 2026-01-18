#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, '..');

async function loadConfig(cwd) {
    const configPath = path.join(cwd, 'assist/settings.json');
    if (await fs.pathExists(configPath)) {
        return fs.readJSON(configPath);
    }
    return { language: 'en' };
}

async function ensureConfigSource(projectRoot, settings) {
    const assistDir = path.join(projectRoot, 'assist');
    const configSourcePath = path.join(assistDir, 'config_source.json');

    const communication_language = settings?.language === 'tr' ? 'Turkish' : 'English';
    const document_output_language = communication_language;

    const output_folder = 'assist/output';
    const planning_artifacts = 'assist/output/planning-artifacts';
    const implementation_artifacts = 'assist/output/implementation-artifacts';
    const project_knowledge = 'assist/output/project-knowledge';

    const cfg = {
        project_name: path.basename(projectRoot),
        project_root: projectRoot,
        // Keep paths repo-relative so they work across machines.
        output_folder,
        artifact_root: output_folder,
        planning_artifacts,
        implementation_artifacts,
        project_knowledge,
        communication_language,
        document_output_language,
        supported_languages: ['English', 'Turkish'],
        user_name: settings?.user_name || 'User'
    };

    await fs.ensureDir(path.join(projectRoot, planning_artifacts));
    await fs.ensureDir(path.join(projectRoot, implementation_artifacts));
    await fs.ensureDir(path.join(projectRoot, project_knowledge));

    // Always (re)write so upgrades fix missing keys.
    await fs.writeJSON(configSourcePath, cfg, { spaces: 2 });
    return { configSourcePath, cfg };
}

function resolveConfigSourceRefs(value, configSource) {
    if (Array.isArray(value)) return value.map(v => resolveConfigSourceRefs(v, configSource));
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) out[k] = resolveConfigSourceRefs(v, configSource);
        return out;
    }
    if (typeof value !== 'string') return value;

    const m = value.match(/^\{config_source\}:(.+)$/);
    if (!m) return value;
    const key = m[1].trim();
    return configSource?.[key] !== undefined ? configSource[key] : value;
}

async function resolvePlaceholders(text, context) {
    if (!text) return '';
    return text.replace(/\{(\w+[\w-]*)\}/g, (match, key) => {
        return context[key] !== undefined ? context[key] : match;
    });
}

async function cmdInit(args) {
    let language = 'en'; // Default
    
    // Check for flags
    const langIndex = args.indexOf('--lang');
    if (langIndex !== -1 && args[langIndex + 1]) {
        language = args[langIndex + 1];
    } else {
        // Interactive prompt
        const answers = await inquirer.prompt([
            {
                type: 'list',
                name: 'language',
                message: 'Select Language / Dil Seçiniz:',
                choices: ['en', 'tr']
            }
        ]);
        language = answers.language;
    }

    const targetDir = process.cwd();
    const assistDir = path.join(targetDir, 'assist');
    
    console.log(`Initializing in ${assistDir}...`);
    
    const srcConfig = path.join(PKG_ROOT, 'config');
    const destConfig = path.join(assistDir, 'config');
    
    // Copy config
    await fs.copy(srcConfig, destConfig);
    
    // Create settings
    await fs.writeJSON(path.join(assistDir, 'settings.json'), {
        language: language,
        project_root: targetDir
    }, { spaces: 2 });

    // Create/update config source so workflows never block on missing placeholders.
    const { cfg: configSource } = await ensureConfigSource(targetDir, { language });

    console.log('Setup complete.');
    
    // Generate .github/agents for Editor Integration
    console.log('Generating Editor Agents in .github/agents/ ...');
    const githubAgentsDir = path.join(targetDir, '.github/agents');
    await fs.ensureDir(githubAgentsDir);

    const agentsDir = path.join(assistDir, 'config/agents');
    const agentFiles = await fs.readdir(agentsDir);

    for (const file of agentFiles) {
        if (!file.endsWith('.yaml')) continue;
        const agentId = path.basename(file, '.yaml');
        // Avoid generating odd filenames like "ai-core master.agent.md".
        if (agentId.includes(' ')) continue;
        
        try {
            const agentYamlContent = await fs.readFile(path.join(agentsDir, file), 'utf8');
            const agentConfig = yaml.load(agentYamlContent);
            
            // Skip if no system prompt or tools
            if (!agentConfig.system_prompt) continue;

            let promptContent = '';
            // If prompt is a file reference
            if (agentConfig.system_prompt.endsWith('.md')) {
                const promptPath = path.join(agentsDir, agentConfig.system_prompt);
                if (await fs.pathExists(promptPath)) {
                    promptContent = await fs.readFile(promptPath, 'utf8');
                }
            } else {
                promptContent = agentConfig.system_prompt;
            }

            // Construct .agent.md content in the expected Copilot/Windsurf "chatagent" format.
            const frontmatter = {
                description: agentConfig.description || `Activates the ${agentId} agent persona.`,
                tools: agentConfig.tools || []
            };

            const agentMdContent = `\`\`\`chatagent\n---\n${yaml.dump(frontmatter).trim()}\n---\n\n${String(promptContent || '').trim()}\n\`\`\`\n`;
            const outFile = `${agentId}.agent.md`;
            await fs.writeFile(path.join(githubAgentsDir, outFile), agentMdContent);
            console.log(`- Created .github/agents/${outFile}`);

        } catch (e) {
            console.warn(`Failed to generate agent for ${file}`, e);
        }
    }

    console.log('\nSUCCESS: Agents are now ready.');

    // If a legacy Windsurf rules file exists, it can override newer discovery in `.windsurf/`.
    // Move it aside so `.windsurf/rules` and `.windsurf/workflows` are used.
    const legacyWindsurfRulesFile = path.join(targetDir, '.windsurfrules');
    if (await fs.pathExists(legacyWindsurfRulesFile)) {
        const backupName = `.windsurfrules.bak.${new Date().toISOString().replace(/[:.]/g, '-')}`;
        const backupPath = path.join(targetDir, backupName);
        try {
            await fs.move(legacyWindsurfRulesFile, backupPath, { overwrite: true });
            console.log(`- Moved legacy .windsurfrules -> ${backupName}`);
        } catch {
            // best-effort
        }
    }

    // Windsurf/Cascade uses .windsurf/rules (for @mention rules) and .windsurf/workflows (for /slash workflows).
    console.log('Generating .windsurf/rules and .windsurf/workflows for Windsurf/Cascade...');
    const windsurfDir = path.join(targetDir, '.windsurf');
    const windsurfRulesDir = path.join(windsurfDir, 'rules');
    const windsurfWorkflowsDir = path.join(windsurfDir, 'workflows');
    await fs.ensureDir(windsurfRulesDir);
    await fs.ensureDir(windsurfWorkflowsDir);

    // 1) Rules: one per persona. These show up in Windsurf's Rules UI (not as "Code/Ask" modes).
    for (const file of agentFiles) {
        if (!file.endsWith('.yaml')) continue;
        const agentId = path.basename(file, '.yaml');
        if (agentId.includes(' ')) continue;

        try {
            const agentYamlContent = await fs.readFile(path.join(agentsDir, file), 'utf8');
            const agentConfig = yaml.load(agentYamlContent);
            if (!agentConfig?.system_prompt) continue;

            let promptContent = '';
            if (typeof agentConfig.system_prompt === 'string' && agentConfig.system_prompt.endsWith('.md')) {
                const promptPath = path.join(agentsDir, agentConfig.system_prompt);
                if (await fs.pathExists(promptPath)) promptContent = await fs.readFile(promptPath, 'utf8');
            } else {
                promptContent = String(agentConfig.system_prompt);
            }

            // Windsurf Rules are markdown WITH frontmatter.
            // Also: rule files are limited to ~12000 chars.
            const safePrompt = String(await resolvePlaceholders(String(promptContent || '').trim(), {
                ...configSource,
                config_source: 'assist/config_source.json',
                'project-root': targetDir,
                project_root: targetDir
            })).slice(0, 10500);
            const ruleFrontmatter = {
                name: agentId,
                description: agentConfig.description || `Assist persona: ${agentId}`,
                activation: 'manual'
            };
            const ruleMd = `---\n${yaml.dump(ruleFrontmatter).trim()}\n---\n\n${safePrompt}\n`;
            await fs.writeFile(path.join(windsurfRulesDir, `${agentId}.md`), ruleMd);
            console.log(`- Created .windsurf/rules/${agentId}.md`);
        } catch {
            // best-effort
        }
    }

    // 1b) Persona workflows: quick switching via slash commands like `/dev`, `/analyst`, etc.
    // These are NOT the same as Windsurf's built-in modes (Code/Ask), but are the closest UX.
    for (const file of agentFiles) {
        if (!file.endsWith('.yaml')) continue;
        const agentId = path.basename(file, '.yaml');
        if (agentId.includes(' ')) continue;

        const outPath = path.join(windsurfWorkflowsDir, `${agentId}.md`);
        if (await fs.pathExists(outPath)) continue; // don't clobber an existing workflow

        try {
            const agentYamlContent = await fs.readFile(path.join(agentsDir, file), 'utf8');
            const agentConfig = yaml.load(agentYamlContent);
            if (!agentConfig?.system_prompt) continue;

            let promptContent = '';
            if (typeof agentConfig.system_prompt === 'string' && agentConfig.system_prompt.endsWith('.md')) {
                const promptPath = path.join(agentsDir, agentConfig.system_prompt);
                if (await fs.pathExists(promptPath)) promptContent = await fs.readFile(promptPath, 'utf8');
            } else {
                promptContent = String(agentConfig.system_prompt);
            }

            const safePrompt = String(await resolvePlaceholders(String(promptContent || '').trim(), {
                ...configSource,
                config_source: 'assist/config_source.json',
                'project-root': targetDir,
                project_root: targetDir
            })).slice(0, 10500);
            const desc = agentConfig?.description ? `\n\n${agentConfig.description}` : '';
            const wfMd = `# /${agentId}${desc}\n\nSwitch to the **${agentId}** persona for this chat.\n\n${safePrompt}\n`;
            await fs.writeFile(outPath, wfMd.slice(0, 12000));
            console.log(`- Created .windsurf/workflows/${agentId}.md`);
        } catch {
            // best-effort
        }
    }

    // 2) Workflows: one per workflow, so user can type /prd, /dev-story, etc.
    const workflowConfigDir = path.join(assistDir, 'config/workflows');
    if (await fs.pathExists(workflowConfigDir)) {
        const wfFiles = await fs.readdir(workflowConfigDir);
        for (const wfFile of wfFiles) {
            if (!wfFile.endsWith('.yaml')) continue;
            const wfId = path.basename(wfFile, '.yaml');

            try {
                const wfYamlContent = await fs.readFile(path.join(workflowConfigDir, wfFile), 'utf8');
                const wf = yaml.load(wfYamlContent);

                let instructionsText = '';
                if (typeof wf?.instructions === 'string' && wf.instructions.endsWith('.md')) {
                    const p = path.join(workflowConfigDir, wf.instructions);
                    if (await fs.pathExists(p)) instructionsText = await fs.readFile(p, 'utf8');
                } else if (wf?.instructions) {
                    instructionsText = String(wf.instructions);
                }

                // Resolve any placeholders so Windsurf workflows don't ask users for missing config_source values.
                instructionsText = await resolvePlaceholders(String(instructionsText || ''), {
                    ...configSource,
                    config_source: 'assist/config_source.json',
                    'project-root': targetDir,
                    project_root: targetDir
                });

                const title = `/${wfId}`;
                const desc = wf?.description ? `\n\n${wf.description}` : '';
                const body = String(instructionsText || '').trim();
                const wfMd = `# ${title}${desc}\n\n${body}\n`;

                // Workflow files are limited to 12000 chars.
                await fs.writeFile(path.join(windsurfWorkflowsDir, `${wfId}.md`), wfMd.slice(0, 12000));
                console.log(`- Created .windsurf/workflows/${wfId}.md`);
            } catch {
                // best-effort
            }
        }
    }

    console.log('You may need to reload Windsurf to see Rules and /workflows.');
}

async function cmdList() {
    const workflowsDir = path.join(process.cwd(), 'assist/config/workflows');
    if (!await fs.pathExists(workflowsDir)) {
        console.error('Assist not initialized. Run "assist init" first.');
        return;
    }
    
    const files = await fs.readdir(workflowsDir);
    console.log('Available Workflows:');
    for (const file of files) {
        if (file.endsWith('.yaml')) {
            const content = await fs.readFile(path.join(workflowsDir, file), 'utf8');
            const data = yaml.load(content);
            console.log(`- ${data.name}: ${data.description}`);
        }
    }
}

async function cmdRun(workflowName) {
    const settings = await loadConfig(process.cwd());
    const { cfg: configSource } = await ensureConfigSource(process.cwd(), settings);
    const workflowPath = path.join(process.cwd(), 'assist/config/workflows', `${workflowName}.yaml`);
    
    if (!await fs.pathExists(workflowPath)) {
        console.error(`Workflow ${workflowName} not found.`);
        return;
    }

    const content = await fs.readFile(workflowPath, 'utf8');
    const workflowRaw = yaml.load(content);
    const workflow = resolveConfigSourceRefs(workflowRaw, configSource);
    
    // Define standard paths
    const outputDir = path.join(process.cwd(), String(configSource.output_folder || 'assist/output'));

    // Build context (System defaults override Workflow defaults)
    const context = {
        ...workflow, // Load workflow variables first (so we can override placeholders)
        
        // System Overrides
        communication_language: configSource.communication_language || (settings.language === 'tr' ? 'Turkish' : 'English'),
        document_output_language: configSource.document_output_language || (settings.language === 'tr' ? 'Turkish' : 'English'),
        project_root: process.cwd(),
        date: new Date().toISOString().split('T')[0],
        
        // Standard Output Paths
        output_folder: configSource.output_folder || outputDir,
        artifact_root: configSource.artifact_root || configSource.output_folder || outputDir,
        planning_artifacts: configSource.planning_artifacts || path.join(outputDir, 'planning-artifacts'),
        implementation_artifacts: configSource.implementation_artifacts || path.join(outputDir, 'implementation-artifacts'),
        config_source: 'assist/config_source.json',
        'project-root': process.cwd(),
        
        // User info
        user_name: configSource.user_name || 'User' 
    };

    console.log(`\n=== Running Workflow: ${workflow.name} ===\n`);
    
    if (workflow.description) {
        console.log(`Description: ${workflow.description}\n`);
    }

    if (workflow.instructions) {
        let instructionsText = workflow.instructions;
        
        // If it looks like a file path (ends in .md) and is short, try to read it
        if (typeof instructionsText === 'string' && instructionsText.endsWith('.md') && instructionsText.length < 256) {
           const potentialPath = path.join(path.dirname(workflowPath), instructionsText);
           if (await fs.pathExists(potentialPath)) {
               instructionsText = await fs.readFile(potentialPath, 'utf8');
           }
        }

        const resolved = await resolvePlaceholders(instructionsText, context);
        console.log('--- Instructions ---');
        console.log(resolved);
        console.log('--------------------');
    }

    if (workflow.template) {
        console.log('\n--- Template ---');
        console.log(workflow.template);
        console.log('----------------');
    }
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    try {
        if (command === 'init') {
            await cmdInit(args);
        } else if (command === 'list') {
            await cmdList();
        } else if (command === 'run') {
            const workflowName = args[1];
            if (!workflowName) {
                console.error('Usage: assist run <workflow-name>');
            } else {
                await cmdRun(workflowName);
            }
        } else {
            console.log('Usage: assist <init|list|run>');
        }
    } catch (err) {
        console.error(err);
    }
}

main();
