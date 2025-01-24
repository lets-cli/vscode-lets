import { Command, CustomCommand } from './command';

export class LetsState {
	public commands: Command[] = [];
	public customCommands: CustomCommand[] = [];

	public addCustomCommand(command: CustomCommand) {
		this.customCommands.push(command);
	}

	public removeCustomCommand(customCommand: CustomCommand) {
		this.customCommands = this.customCommands.filter((command) => command.id !== customCommand.id);
	}
}