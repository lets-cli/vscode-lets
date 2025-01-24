import { log } from '../log';

export type CommandsMapping = {
    [key: string]: Command;
};

function hashCode(s: string): number {
	let hash = 0;
	if (s.length === 0) return hash;
	for (let i = 0; i < s.length; i++) {
	  let chr = s.charCodeAt(i);
	  hash = ((hash << 5) - hash) + chr;
	  hash |= 0; // Convert to 32bit integer
	}
	return hash;
}

// Command must be json serializable to be stored in workspaceState for now
export type Command = {
	name: string;
	description: string;
	args: string | null;
	label: string;
}

export type CustomCommand = {
	id: number;  // hash of the command name and args
} & Command;

export const createCommand = (name: string, description: string, args: string | null = null, label: string | null = null): Command => {
	return {
		name,
		description,
		args,
		label: label || name,
	}
}

export const createCustomCommand = (name: string, description: string, args: string | null = null, label: string | null = null): CustomCommand => {
	return {
		id: hashCode(name + (args || "")),
		name,
		description,
		args,
		label: label || name,
	}
}


export const isCustomCommand = (command: Command | CustomCommand): command is CustomCommand => {
	return (command as CustomCommand).id !== undefined;
}