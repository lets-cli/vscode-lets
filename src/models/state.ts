import { Command } from './command';

export class LetsState {
	public commands: Command[] = [];
	public customCommands: Command[] = [];

	// TODO: three ways of handle such custom commands
	// 1. append or prepend to the existing commands
	// 2. insert after the original command
	// 3. separate var and section in view for custom commands
	public addCustomCommand(command: Command) {
		this.customCommands.push(command);
	}
}