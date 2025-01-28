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
import { Config } from "./config";
import { log } from './log';

const SKIP_VERSION_STATE_KEY = "skipUpdate";
const LETS_REPO = "https://github.com/lets-cli/lets"

const WORKSPACE_STORAGE_CUSTOM_COMMANDS_KEY = 'lets:customCommands';

export class LetsExtension {
    public client: LanguageClient;

    private _activityBar: components.ActivityBar;
    private letsService: services.LetsService
    private letsState: models.LetsState
    private config: Config

    constructor(config: Config) {
        this._activityBar = new components.ActivityBar();
        this.letsService = new services.LetsService(config.executable);
        this.letsState = new models.LetsState();
        this.config = config;
    }

    isRunning() {
        return this.client?.isRunning();
    }

    activate(context: ExtensionContext) {
        const outputChannel: OutputChannel = vscode.window.createOutputChannel("Lets");

        const executablePath: string = this.config.executable;
        const debug: boolean = this.config.debug;
        const logPath: string = this.config.logPath;

        let env = null;
        if (debug) {
            // TODO: add debug support
            // env = { };
        }
        let run: Executable = {
            command: executablePath,
            args: ["self", "lsp"],
            options: {
                env
            }
        };
        log.info(`Starting Lets Language Server with executable: ${executablePath}`);
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
        this.loadCustomCommands(context);
        // this.checkUpdates(context, executablePath);
    }

    loadCustomCommands(context: vscode.ExtensionContext) {
        const customCommandsFromStorage: models.CustomCommand[] = context.workspaceState.get(WORKSPACE_STORAGE_CUSTOM_COMMANDS_KEY, []);
        customCommandsFromStorage.forEach((command) => {
            this.letsState.addCustomCommand(command);
        });
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
        this._activityBar.refresh(this.letsState.commands, this.letsState.customCommands);
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
                let letsCommand = treeItem.letsCommand;

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
                    value: letsCommand.name
                });
                if (customName === undefined) {
                    vscode.window.showInformationMessage('No custom name supplied');
                    return;
                }
                if (customName === letsCommand.name) {
                    vscode.window.showInformationMessage('Custom name cannot be the same as the original name');
                    return;
                }

                let customDescription = await vscode.window.showInputBox({
                    prompt: "Enter Custom Description (optional):",
                });

                const customCommand = models.createCustomCommand(letsCommand.name, customDescription || letsCommand.description, args, customName)
                this.letsState.addCustomCommand(customCommand);

                const customCommandsFromStorage: models.CustomCommand[] = context.workspaceState.get(WORKSPACE_STORAGE_CUSTOM_COMMANDS_KEY, []);
                customCommandsFromStorage.push(customCommand);
                context.workspaceState.update(WORKSPACE_STORAGE_CUSTOM_COMMANDS_KEY, customCommandsFromStorage);

                this.refresh();
            }
        }));

        context.subscriptions.push(vscode.commands.registerCommand('vscode-lets.removeCustomCommand', async (treeItem?: components.CommandTreeItem) => {
            if (treeItem?.letsCommand && models.isCustomCommand(treeItem.letsCommand)) {
                let letsCommand = treeItem.letsCommand;

                this.letsState.removeCustomCommand(letsCommand);

                const customCommandsFromStorage: models.CustomCommand[] = context.workspaceState.get(WORKSPACE_STORAGE_CUSTOM_COMMANDS_KEY);
                context.workspaceState.update(WORKSPACE_STORAGE_CUSTOM_COMMANDS_KEY, customCommandsFromStorage.filter((command) => command.id !== letsCommand.id));

                this.refresh();
            }
        }));
    }

    async checkUpdates(context: ExtensionContext, executable: string): Promise<void> {
        const res = await fetch(`${LETS_REPO}/releases/latest`);

        const { tag_name } = (await res.json()) as any;

        // check if skipped
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