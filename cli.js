#!/usr/bin/env node

import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import concurrently from 'concurrently';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const command = args[0];

const paths = {
    backend: path.join(__dirname, 'backend'),
    frontend: path.join(__dirname, 'frontend'),
    venv: path.join(__dirname, 'backend', 'venv'),
    python: process.platform === 'win32' 
        ? path.join(__dirname, 'backend', 'venv', 'Scripts', 'python.exe')
        : path.join(__dirname, 'backend', 'venv', 'bin', 'python')
};

async function setup() {
    console.log(chalk.blue.bold('\n🚀 Starting TrimTube Global Setup...\n'));

    try {
        // 1. Backend Setup
        console.log(chalk.yellow('📦 Setting up Backend (Python)...'));
        if (!process.env.VIRTUAL_ENV) {
            execSync(`python -m venv "${paths.venv}"`, { stdio: 'inherit', cwd: paths.backend });
        }
        console.log(chalk.green('✅ Virtual environment ready.'));
        
        console.log(chalk.yellow('📥 Installing Python dependencies...'));
        execSync(`"${paths.python}" -m pip install -r requirements.txt`, { stdio: 'inherit', cwd: paths.backend });
        console.log(chalk.green('✅ Backend dependencies installed.'));

        // 2. Frontend Setup
        console.log(chalk.yellow('\n📦 Setting up Frontend (Node.js)...'));
        execSync('npm install', { stdio: 'inherit', cwd: paths.frontend });
        console.log(chalk.green('✅ Frontend dependencies installed.'));

        console.log(chalk.blue.bold('\n✨ Setup Complete!'));
        console.log(chalk.white(`Run ${chalk.cyan('ttyt run')} to start the application.\n`));
    } catch (error) {
        console.error(chalk.red('\n❌ Setup failed:'), error.message);
        process.exit(1);
    }
}

async function run() {
    // Check if setup is needed
    const nodeModulesExist = (await import('fs')).existsSync(paths.frontend + '/node_modules');
    const venvExists = (await import('fs')).existsSync(paths.venv);

    if (!nodeModulesExist || !venvExists) {
        console.log(chalk.yellow('ℹ️ First time setup detected. Running auto-setup...'));
        await setup();
    }

    console.log(chalk.blue.bold('\n🎬 Launching TrimTube AI...\n'));

    const { result } = concurrently([
        { 
            command: `"${paths.python}" main.py`, 
            name: 'Backend', 
            cwd: paths.backend,
            prefixColor: 'magenta'
        },
        { 
            command: 'npm run dev -- --host', 
            name: 'Frontend', 
            cwd: paths.frontend,
            prefixColor: 'cyan'
        }
    ], {
        prefix: 'name',
        killOthers: ['failure', 'success'],
        restartTries: 3,
    });

    result.catch((err) => {
        if (err) console.error(chalk.red('\n❌ Process exited with error.'));
    });
}

switch (command) {
    case 'setup':
        setup();
        break;
    case 'run':
        run();
        break;
    default:
        console.log(chalk.white(`
${chalk.blue.bold('TrimTube CLI')}
Usage:
  ${chalk.cyan('ttyt setup')} - Install all dependencies
  ${chalk.cyan('ttyt run')}   - Start the application
        `));
        break;
}
