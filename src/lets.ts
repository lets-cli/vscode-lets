import { execSync } from "child_process";
import * as vscode from "vscode";
import { ExtensionContext, OutputChannel } from "vscode";
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    RevealOutputChannelOn,
    Executable,
} from "vscode-languageclient/node";

import * as components from "./components";
import * as services from "./services";
import * as models from "./models";
import { log } from './log';

const SKIP_VERSION_STATE_KEY = "skipUpdate";
const LETS_REPO = "https://github.com/lets-cli/lets"


export class LetsExtension {
    public client: LanguageClient;

    private _activityBar: components.ActivityBar;
    private letsService: services.LetsService
    private letsState: models.LetsState

    constructor() {
        this._activityBar = new components.ActivityBar();
        this.letsService = new services.LetsService();
        this.letsState = new models.LetsState();
    }

    isRunning() {
        return this.client?.isRunning();
    }

    activate(context: ExtensionContext) {
        const outputChannel: OutputChannel = vscode.window.createOutputChannel("Lets");

        const config = vscode.workspace.getConfiguration("letsLs");
        const executablePath: string = config.get("executablePath");
        const debug: boolean = config.get("debug");
        const logPath: string = config.get("logPath");

        let env = null;
        if (debug) {
            env = {
                RUST_LOG: "debug",
            };
        }
        let run: Executable = {
            command: executablePath,
            options: {
                env
            }
        };
        const serverOptions: ServerOptions = {
            run,
            debug: run,
        };

        const clientOptions: LanguageClientOptions = {
            documentSelector: [
                { scheme: "file", language: "yaml", pattern: "**/lets.yaml" },
                { scheme: "file", language: "yaml", pattern: "**/lets.*.yaml" },
            ],
            initializationOptions: {
                log_path: logPath,
            },
            outputChannel,
            outputChannelName: 'Lets Language Server',
            revealOutputChannelOn: RevealOutputChannelOn.Never,
            initializationFailedHandler(err) {
                outputChannel.appendLine('Initialization failed');
                outputChannel.appendLine(err.message);
                if (err.stack) {
                    outputChannel.appendLine(err.stack);
                }
                return false;
            },
        };

        this.client = new LanguageClient(
            "letsLs",
            serverOptions,
            clientOptions,
        );

        // Start the client. This will also launch the server
        this.client.start();

        this.registerCommands(context, outputChannel);
        // this.checkUpdates(context, executablePath);
    }
    deactivate(): Promise<void> {
        return this.client.stop()
    }

    setTreeNesting(enabled: boolean): void {
        this._activityBar.setTreeNesting(enabled);
        vscode.commands.executeCommand('setContext', 'vscode-lets:treeNesting', enabled);
    }

    async refresh() {
        this.letsState.commands = await this.letsService.readCommands();
        let commands = this.letsState.commands.concat(this.letsState.customCommands);
        this._activityBar.refresh(commands);
    }

    registerCommands(context: ExtensionContext, outputChannel: OutputChannel) {
        context.subscriptions.push(
            vscode.commands.registerCommand('vscode-lets.restart', async () => {
                try {
                    outputChannel.appendLine('Stopping Lets Language server');
                    await this.client.stop();

                    outputChannel.appendLine('Restarting Lets Language server');
                    await this.client.start();
                    outputChannel.appendLine('Lets Language server restarted');
                } catch (e) {
                    outputChannel.appendLine(`Failed to restart Lets Language server: ${e}`);
                }
            })
        );
        // Refresh commands
        context.subscriptions.push(vscode.commands.registerCommand('vscode-lets.refresh', () => {
            log.info("Command: vscode-lets.refresh");
            this.refresh();
        }));

        // View commands as list
        context.subscriptions.push(vscode.commands.registerCommand('vscode-lets.showCommands', () => {
            log.info("Command: vscode-lets.showCommands");
            this.setTreeNesting(false);
        }));

        // Run command without args
        context.subscriptions.push(vscode.commands.registerCommand('vscode-lets.runCommand', (treeItem?: components.CommandTreeItem) => {
            log.info("Command: vscode-lets.runCommand");
            if (treeItem?.letsCommand) {
                this.letsService.runCommand(treeItem.letsCommand);
            }
        }));

        // Clone command with custom args
        context.subscriptions.push(vscode.commands.registerCommand('vscode-lets.cloneCommand', async (treeItem?: components.CommandTreeItem) => {
            log.info(`Command: vscode-lets.cloneCommand: ${treeItem?.letsCommand?.name}`);
            if (treeItem?.letsCommand) {
                let args = await vscode.window.showInputBox({
                    prompt: "Enter Command Line Arguments:",
                    placeHolder: "<arg1> <arg2> ..."
                });
                if (args === undefined) {
                    vscode.window.showInformationMessage('No args supplied');
                    return;
                }

                let customName = await vscode.window.showInputBox({
                    prompt: "Enter Custom Command Name:",
                    value: treeItem.letsCommand.name
                });
                if (customName === undefined) {
                    vscode.window.showInformationMessage('No custom name supplied');
                    return;
                }
                if (customName === treeItem.letsCommand.name) {
                    vscode.window.showInformationMessage('Custom name cannot be the same as the original name');
                    return;
                }

                let customDescription = await vscode.window.showInputBox({
                    prompt: "Enter Custom Description (optional):",
                });

                // TODO: store custom commands, like a command with -w flag. We can save it to somewhere

                this.letsState.addCustomCommand(
                    new models.Command(customName, customDescription || treeItem.letsCommand.description, args)
                );
                this.refresh();
            }
        }));
    }

    async checkUpdates(context: ExtensionContext, executable: string): Promise<void> {
        const res = await fetch(`${LETS_REPO}/releases/latest`);

        // js is perfect
        const { tag_name } = (await res.json()) as any;

        //check if skipped
        const val = context.globalState.get(SKIP_VERSION_STATE_KEY);
        if (val && val === tag_name) {
            return;
        }

        const version = execSync(`${executable} --version`).toString();

        // older version which doesn't support --version
        if (!version) {
            return;
        }

        // format of: lets X.X.X
        const versionSplit = version.split(" ");

        // shouldn't occur
        if (versionSplit.length != 2) {
            return;
        }

        const versionTag = versionSplit[1].trim();

        if (tag_name != versionTag) {
            vscode.window
                .showInformationMessage(
                    "There is a newer version of Lets language server.",
                    "Show installation guide",
                    "Show changes",
                    "Skip this version",
                )
                .then((answer) => {
                    let url = "";
                    if (answer === "Show changes") {
                        url = `${LETS_REPO}/compare/${versionTag}...${tag_name}`;
                    } else if (answer === "Show installation guide") {
                        url = `${LETS_REPO}?tab=readme-ov-file#installation`;
                    } else if (answer === "Skip this version") {
                        context.globalState.update(SKIP_VERSION_STATE_KEY, tag_name);
                    }

                    if (url != "") {
                        vscode.env.openExternal(vscode.Uri.parse(url));
                    }
                });
        }
    }

}