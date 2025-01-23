export type CommandsMapping = {
    [key: string]: Command;
};

export class Command {
	public args: string | null;

	constructor(public name: string, public description: string, args: string | null = null) {
		this.name = name;
		this.description = description;
		this.args = args;
	}
}