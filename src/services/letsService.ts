import * as cp from 'child_process';
import * as vscode from 'vscode';

import * as models from '../models';
import { log } from '../log';


type ExecutionResult = {
	stdout: string;
	stderr: string;
	error: cp.ExecException | null;
	hasError: boolean;
};

export class LetsService {
	private executable: string;
	private static terminal: vscode.Terminal | undefined;

	constructor(executable: string) {
		this.executable = executable;
	}

	private async execute(command: string, dir?: string): Promise<ExecutionResult> {
        return await new Promise((resolve) => {
			cp.exec(command, { cwd: dir }, (error: cp.ExecException | null, stdout: string, stderr: string) => {
				return resolve({ stdout, stderr, error, hasError: !!error || stderr.length > 0 });
			});
		});
	}

	private formatCommand(command: string, args: string | null): string {
		if (args === null) {
			return `${this.executable} ${command}`;
		}

		return `${this.executable} ${command} ${args}`;
	}

    async runCommand(letsCommand: models.Command) {
		log.info(`Running lets command: ${letsCommand.name}, args: ${letsCommand.args}`);

		if (LetsService.terminal?.exitStatus !== undefined) {
			log.info(`Terminal is already closed, disposing it`);
			LetsService.terminal.dispose();
			LetsService.terminal = undefined;
		}

		if (LetsService.terminal === undefined) {
			log.info(`Creating new terminal to run lets commad: ${letsCommand.name}`);
			LetsService.terminal = vscode.window.createTerminal("Lets");
		} else {
            log.info(`Using existing terminal: ${LetsService.terminal}`);
		}
		let term = LetsService.terminal;
		term.show();
		term.sendText(this.formatCommand(letsCommand.name, letsCommand.args));
    }

    async readCommands(): Promise<models.Command[]> {
		const dir = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
		const result = await this.execute(this.formatCommand("completion", "--list --verbose"), dir);
		if (result.hasError) {
			log.info(`Failed to read commands: ${result.stderr}`);
			return [];
		}

		const lines = result.stdout.trim().split("\n");
		return lines
		.map(line => {
			const [name, description] = line.split(":");
			return models.createCommand(name, description);
		});
    }
}