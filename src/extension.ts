/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import { ExtensionContext } from "vscode";
import * as vscode from "vscode";
import { LetsExtension } from "./lets";
import { Config } from './config';

let extension: LetsExtension;

export function activate(context: ExtensionContext) {
  if (extension?.isRunning()) {
    return;
  }

  const config = vscode.workspace.getConfiguration("lets");
  const executablePath: string = config.get("executablePath");
  const debug: boolean = config.get("debug");
  const logPath: string = config.get("logPath");

  extension = new LetsExtension(new Config(executablePath, debug, logPath));
  extension.activate(context);
  extension.refresh();
}

export function deactivate(): Thenable<void> | undefined {
  if (!extension) {
    return undefined;
  }
  return extension.deactivate();
}