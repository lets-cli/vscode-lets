export class Config {
	public executable: string;
	public debug: boolean;
	public logPath: string;

	constructor(executable: string, debug: boolean, logPath: string) {
		this.executable = executable;
		this.debug = debug;
		this.logPath = logPath;
	}
}