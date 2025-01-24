import * as vscode from 'vscode';
import * as models from '../models';

export type TreeItem = NamespaceTreeItem | CommandTreeItem;

export class NamespaceTreeItem extends vscode.TreeItem {
    constructor(
        readonly label: string,
        readonly workspace: string,
        readonly letsCommands: Array<models.Command | models.CustomCommand>,
        readonly collapsibleState: vscode.TreeItemCollapsibleState,
        readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.description = this.workspace;
        this.contextValue = 'workspaceTreeItem';
    }
}

export class CommandTreeItem extends vscode.TreeItem {
    constructor(
        readonly label: string,
        readonly letsCommand: models.Command | models.CustomCommand,
        readonly collapsibleState: vscode.TreeItemCollapsibleState,
        readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.description = this.letsCommand?.description || "";
        if (this.description.startsWith("No description")) {
            this.description = false;
        };
        const isCustomCommand = models.isCustomCommand(letsCommand);
        const icon = isCustomCommand ? 'debug-breakpoint-log' : 'debug-breakpoint';
        this.iconPath = new vscode.ThemeIcon(icon, new vscode.ThemeColor('letsls.upToDateIcon'));
        this.contextValue = isCustomCommand ? 'customCommandTreeItem' : 'commandTreeItem';
    }
}
