import * as vscode from 'vscode';
import * as components from '../components';
import * as models from '../models';

export class CommandsProvider implements vscode.TreeDataProvider<components.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<components.CommandTreeItem | undefined> = new vscode.EventEmitter<components.CommandTreeItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<components.CommandTreeItem | undefined> = this._onDidChangeTreeData.event;

	private commands: models.Command[] = [];
	private customCommands: models.CustomCommand[] = [];

    constructor(
        private nestingEnabled: boolean = false
    ) { }

    setTreeNesting(enabled: boolean) {
        this.nestingEnabled = enabled;
    }

    getTreeItem(element: components.TreeItem): vscode.TreeItem {
        return element;
    }

	getChildren(parent?: components.TreeItem): vscode.ProviderResult<components.TreeItem[]> {
        if (!parent && this.customCommands.length > 0) {
            return Promise.resolve(this.getNamespaces());
        } else if (parent instanceof components.NamespaceTreeItem) {
            return Promise.resolve(this.getCommandsTreeItems(parent.letsCommands));
        } else {
            return Promise.resolve(this.getCommandsTreeItems(this.commands));
        }
	}

    getCommandsTreeItems(commands: models.Command[] | models.CustomCommand[]): components.CommandTreeItem[] {
        return commands.map(command => {
            return new components.CommandTreeItem(
                command.label,
                command,
                vscode.TreeItemCollapsibleState.None,
                undefined,
            );
        });
    }

    getNamespaces(): components.NamespaceTreeItem[] {
        return [
            new components.NamespaceTreeItem(
                "Commands",
                "",
                this.commands,
                vscode.TreeItemCollapsibleState.Expanded
            ),
            new components.NamespaceTreeItem(
                "Custom commands",
                "",
                this.customCommands,
                vscode.TreeItemCollapsibleState.Expanded
            )
        ];
    }

    refresh(commands?: models.Command[], customCommands?: models.CustomCommand[]) {
		if (commands) {
			this.commands = commands;
            this.commands.sort((a, b) => (a.label > b.label ? -1 : 1))
		}
        if (customCommands) {
            this.customCommands = customCommands;
            this.customCommands.sort((a, b) => (a.label > b.label ? -1 : 1))
        }
        this._onDidChangeTreeData.fire(undefined);
    }

}