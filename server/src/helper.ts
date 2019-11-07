import * as ts from 'typescript';
import { CompletionItemKind, CompletionItem } from 'vscode-languageserver';

const flattenDeep = (arr: any[]): any[] => Array.isArray(arr)
	? arr.reduce((a, b) => a.concat(flattenDeep(b)), [])
	: [arr];

export function findSourceFile(program: ts.Program, fileName: string): ts.SourceFile | null {
	for (const file of program.getSourceFiles()) {
		if (file.fileName === fileName) {
			return file;
		}
	}
	return null;
}


function deepNodeMap<T extends ts.Node>(nodes: T[], callback: (node: T) => void, res: any[] = []): any[] {
	if (nodes.length > 0) {
		return flattenDeep(nodes.map((value) => {
			if (value.getChildCount() > 0) {
				return [callback(value), deepNodeMap(value.getChildren() as T[], callback, res)];
			} else {
				return [callback(value)];
			}
		})).filter(_ => _);
	}
	return res;
}

export function searchEggConfigNode(source: ts.SourceFile) {
	let configNode = null;
	ts.forEachChild(source, (node) => {
		if (ts.isInterfaceDeclaration(node)) {
			if (node.heritageClauses) {
				node.heritageClauses.forEach((dnode) => {
					dnode.types.forEach(_node => {
						if ((_node.expression as ts.Identifier).escapedText === 'EggAppConfig') {
							configNode = node;
						}
					});
				});
			}
		}
	})
	return configNode;
}

function findNodeAtPos<T extends ts.Node>(sourceFile: ts.SourceFile, pos: number): T[] | null {
	const res = deepNodeMap(sourceFile.getChildren(), node => {
		if (ts.isInterfaceDeclaration(node)) {
			if (node.name.pos === pos) {
				return node as any as T;
			}
		} else {
			if (node.pos === pos) {
				return node as any as T;
			}
		}
	})

	return res[0]
}

function findDefinition(services: ts.LanguageService, node: ts.Node): any[] {
	let pos = 0;
	if (ts.isHeritageClause(node)) {
		pos = node.types[0].pos + 1;
	}
	if (ts.isPropertySignature(node)) {
		if (node.type) {
			pos = node.type.pos + 1;
		}
	}
	const definitions = services.getDefinitionAtPosition(node.getSourceFile().fileName, pos);
	const program = services.getProgram();
	if (program) {
		if (definitions && definitions.length > 0) {
			return definitions.map(definition => {
				const source = findSourceFile(program, definition.fileName);
				if (source) {
					return findNodeAtPos(source, definition.textSpan.start - 1);
				}
			})
		}
	}
	return [];
}

// export function mapConfig(service: ts.LanguageService, configNode: ts.Node, config: any = {}) {
// 	if (ts.isInterfaceDeclaration(configNode)) {
// 		if (configNode.heritageClauses && configNode.heritageClauses.length > 0) {
// 			configNode.heritageClauses.forEach(node => {
// 				Object.assign(config, mapConfig(service, node, {}))
// 			})
// 		}
// 		if (configNode.members) {
// 			configNode.members.forEach((member) => {
// 				Object.assign(config, mapConfig(service, member, {}))
// 			})
// 		}
// 	}

// 	if (ts.isPropertySignature(configNode)) {
// 		if ((configNode.type) && configNode.type.kind === ts.SyntaxKind.TypeReference) {
// 			findDefinition(service, configNode).forEach(definition => {
// 				Object.assign(config, {
// 					[configNode.name.getText()]: {
// 						children: mapConfig(definition, {} as ts.Node),
// 						node: configNode
// 					}
// 				})
// 			})
// 		} else {

// 			config[configNode.name.getText()] = {
// 				kind: (configNode.type ? configNode.type.kind : null),
// 				node: configNode
// 			}

// 			if (configNode.type && ts.isArrayTypeNode(configNode.type)) {
// 				if (!(configNode.name as ts.Identifier).text) {
// 					debugger
// 				}
// 				config[(configNode.name as ts.Identifier).getText()].elementKind = (configNode.type as ts.ArrayTypeNode).elementType.kind
// 			}


// 			if (configNode.type && ts.isTypeLiteralNode(configNode.type)) {
// 				Object.assign(config, {
// 					[configNode.name.getText()]: {
// 						children: mapConfig(service, configNode.type as ts.Node, {}),
// 						node: configNode.type
// 					}
// 				})
// 			}
// 		}
// 	}

// 	if (ts.isImportDeclaration(configNode)) {
// 		findDefinition(service, configNode).map(definition => {
// 			return mapConfig(definition, {} as ts.Node)
// 		}).forEach(v => {
// 			Object.assign(config, v)
// 		})
// 	}

// 	if (ts.isHeritageClause(configNode)) {
// 		findDefinition(service, configNode).map(definition => {
// 			return mapConfig(definition, {} as ts.Node)
// 		}).forEach(v => {
// 			Object.assign(config, v)
// 		})
// 	}

// 	if (ts.isTypeLiteralNode(configNode)) {
// 		configNode.members.forEach(member => {
// 			Object.assign(config, mapConfig(service, member, {}))
// 		})
// 	}

// 	return config;
// }

export function mapConfig(service: ts.LanguageService, configNode: ts.Node, config: ts.MapLike<any> = {}) {
	if (ts.isInterfaceDeclaration(configNode)) {
		if (configNode.heritageClauses && configNode.heritageClauses.length > 0) {
			configNode.heritageClauses.forEach(node => {
				Object.assign(config, mapConfig(service, node, {}))
			})
		}
		if (configNode.members) {
			configNode.members.forEach((member) => {
				Object.assign(config, mapConfig(service, member, {}))
			})
		}
	}

	if (ts.isPropertySignature(configNode)) {
		if (configNode.type && configNode.type.kind === ts.SyntaxKind.TypeReference) {
			findDefinition(service, configNode).forEach(definition => {
				Object.assign(config, {
					[configNode.name.getText()]: {
						children: mapConfig(service, definition, {}),
						node: configNode
					}
				})
			})
		} else {

			config[configNode.name.getText()] = {
				kind: configNode.type ? configNode.type.kind : null,
				node: configNode
			}

			if (configNode.type && ts.isArrayTypeNode(configNode.type)) {
				if (!(configNode.name as ts.Identifier).text) {
					debugger
				}
				config[(configNode.name as ts.Identifier).getText()].elementKind = (configNode.type as ts.ArrayTypeNode).elementType.kind
			}


			if (configNode.type && ts.isTypeLiteralNode(configNode.type)) {
				Object.assign(config, {
					[configNode.name.getText()]: {
						children: mapConfig(service,configNode.type, {}),
						node: configNode.type
					}
				})
			}
		}
	}

	if (ts.isImportDeclaration(configNode)) {
		findDefinition(service, configNode).map(definition => {
			return mapConfig(service, definition, {})
		}).forEach(v => {
			Object.assign(config, v)
		})
	}

	if (ts.isHeritageClause(configNode)) {
		findDefinition(service, configNode).map(definition => {
			return mapConfig(service, definition, {})
		}).forEach(v => {
			Object.assign(config, v)
		})
	}

	if (ts.isTypeLiteralNode(configNode)) {
		configNode.members.forEach(member => {
			Object.assign(config, mapConfig(service, member, {}))
		})
	}

	console.log(`从`);
	console.log(configNode);
	console.log(`找到了配置项`);
	console.log(config);
	return config;
}

export function EggConfigToCompletionItem(config: ts.MapLike<{ children: any, node: ts.Node, kind: number }>, _key: string = ''): CompletionItem[] {
	let list: CompletionItem[] = []
	for (let key of Object.keys(config)) {
		list.push({
			label: _key === '' ? key : _key + '.' + key,
			kind: CompletionItemKind.Variable,
			detail: '来自 lsp'
		})
		console.log(config[key])
		if (config[key].children) {
			list = list.concat(EggConfigToCompletionItem(config[key].children, key))
		}
	}
	console.log(list)
	return list;
}