'use server';
import { spawn } from 'child_process';

let botProcess;

export const startBotProcess = () => {
    botProcess = spawn('node', ['../../bot.js'], { detached: true });

    botProcess.stdout.on('data', (data) => {
        console.log(`Bot output: ${data}`);
    });

    botProcess.on('close', (code) => {
        console.log(`Bot process for exited with code ${code}`);
        botProcess = null;
    });
};

export const stopBotProcess = () => {
    if (botProcess) {
        botProcess.kill();
        botProcess = null;
    }
};
