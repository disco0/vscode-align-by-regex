'use strict';
import { Block } from './block';
import * as vscode from 'vscode';

//#region Declarations

interface Options {
    template?: string;
}

type Template = string

type TemplateCollection = Map<string, Template>

//#endregion Declarations

//#region Functions

const objectMap = <T extends {[k: string]: any}>(obj: T): Map<keyof T, T[keyof T]> => new Map(Object.entries(obj))

// TODO: Implement as extend map and add event listener to update values
//       on configuration change?
const Templates = new class {
    get configured(): TemplateCollection  {
        return objectMap(vscode.workspace.getConfiguration()
                               .get('align.by.regex.templates', {}))
    }

    get(templateName: string): Template | undefined {
        return this.configured.get(templateName);
    }

    has(templateName: string): boolean {
        return this.configured.has(templateName);
    }
}

/**
 * Read all valid options contained in first element of args parameter in
 * command function.
 */
const readArgs = (arg?: Options | any): Options => {
    const options: Options = {};

    // If any args
    if(!arg) return options;

    // If a valid template arg
    if(arg.template && arg.template.length > 0 && Templates.has(arg.template))
        options.template = arg.template;

    return options
}

//#endregion Functions

//#region Commands

let lastInput: string = "";

const alignByRegex = async (textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit, args: any[]) => {
    let options = readArgs(args as Options),
        input = '';

    // If valid template was passed in args use it for input, else prompt.
    if(options.template)
        input = options.template ?? '';
    else
    {
        input = await vscode.window.showInputBox(
            { 
                prompt: 'Enter regular expression or template name.', 
                value: lastInput,
                ignoreFocusOut: vscode.workspace.getConfiguration().get<boolean>('align.by.regex.ignoreFocusOut')
            }
        ) ?? '';
    }

    if (input.length > 0) {
        // Only add to history if not set from template argument
        if(!options.template)
            lastInput = input;
        else
        {
            const template = Templates.get(input);
            if(template !== undefined) {
                input = template as string;
            }
        }

        // TODO(disco0): Move to separate function
        let selection: vscode.Selection = textEditor.selection;
        if (!selection.isEmpty) {
            let textDocument = textEditor.document;

            // Don't select last line, if no character of line is selected.
            let endLine = selection.end.line;
            let endPosition = selection.end;
            if(endPosition.character === 0)
                endLine--;

            let range = new vscode.Range(new vscode.Position(selection.start.line, 0), new vscode.Position(endLine, textDocument.lineAt(endLine).range.end.character));
            let text = textDocument.getText(range);
            let block: Block = new Block(text, input, selection.start.line, textDocument.eol).trim().align();
            await textEditor.edit(e => {
                for (let line of block.lines) {
                    let deleteRange = new vscode.Range(
                        new vscode.Position(line.number, 0),
                        new vscode.Position(line.number, textDocument.lineAt(line.number).range.end.character)
                    );

                    let replacement: string = '';
                    for (let part of line.parts) {
                        replacement += part.value;
                    }

                    e.replace(deleteRange, replacement);
                }
            });
        }
    }
};

//#endregion Commands

export function activate(context: vscode.ExtensionContext) {
    let alignByRegexCommand = vscode.commands.registerTextEditorCommand('align.by.regex', alignByRegex);
        
    context.subscriptions.push(alignByRegexCommand);
}

// this method is called when your extension is deactivated
export function deactivate() {
}