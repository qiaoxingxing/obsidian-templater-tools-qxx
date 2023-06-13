
//#region 辅助方法
function showMsg(text, timeout) {
	if (!timeout) {
		timeout = 3000
	}
	new Notice(text, timeout)
}

function log(msg) {
	console.log("Message from my script:", msg);
};

function getCMEditor() {
	const editor = app.workspace.activeLeaf.view.editor;
	return editor;
}
/**
 * templater替换文字之后选中新的文字
 * 在选中文字之后、执行替换之前调用这个方法; 
 */
function selectAfterAppended() {
	const cm = getCMEditor()
	const doc = cm.getDoc();
	const oldSelections = doc.listSelections();
	const range = oldSelections[0]
	const startPos = range.anchor.line >= range.head.line && range.anchor.ch >= range.head.ch ? range.head : range.anchor;

	app.workspace.on("templater:template-appended", (data) => {
		console.debug('on templater:template-appended', data);
		app.workspace.off("templater:template-appended")
		const newSelections = doc.listSelections(); //其实什么也没选中, head和anchor是一样的
		const range = newSelections[0]
		const endPos = range.anchor.line >= range.head.line && range.anchor.ch >= range.head.ch ? range.anchor : range.head;
		cm.setSelection(startPos, endPos);
	})
}

/**
 * 返回空格的数目
 * @param {cm} cm 
 * @param {string} line 
 */
function getIndentSpaceCount(cm, line) {
	// console.debug('getIndentSpaceCount',line)
	if (typeof cm !== "object") {
		throw "parameter error";
	}
	if (!line) {
		return 0;
	}
	let match = line.match(/(^\s*)/);
	if (match) {
		let indentUnit = 4 //tab等于几个space
		let space = new Array(indentUnit + 1).join(" ");
		//把制表符替换成空格;
		let allSpace = match[1].replace(/\t/g, space);
		return allSpace.length;
	}
	return 0;
}

/**
 * 获取选中的内容, 如果没有选中, 就选择当前行
 * @returns string
 */
function getSelection() {
	const cm = getCMEditor()
	var cursor = cm.getCursor();
	var selection = cm.getSelection();
	if (!selection) {
		let line = cm.getLine(cursor.line);
		cm.getDoc().setSelection({ line: cursor.line, ch: 0 }, { line: cursor.line, ch: line.length });
		selection = cm.getSelection();
	}
	return selection
}

//#endregion

//#region change heading 相关


/**
   * 修改heading级别
   * @param {输入字符串} source 
   * @param {是否是增加级别: true增加#号, false:减少#号} isAddLevel 
   */
var changeHeadingLevelForString = function (cm, source, isAddLevel) {
	var lines = source.split("\n");
	var num = 0;
	var newLines = []

	var parseLine = function (line, isAddLevel) {
		if (isAddLevel) {
			return line.replace("# ", "## "); //note: replace只会替换一次
		} else {
			return line.replace("## ", "# ");
		}
	}
	let isInCode = false; //在代码块里
	for (var line of lines) {
		if (line.match(/^\s*```/)) {
			isInCode = !isInCode;
		}
		if (isInCode) {
			newLines.push(line)
			continue
		}
		var arr = line.match(/^#+ /g); //#号开头,空格结尾
		if (arr) {
			if (arr[0] === "# " && !isAddLevel) {
				//最高级别是1级; 
				console.info("最高级别是1级")
				showMsg("最高级别是1级,不能调整")
				return;
			}
			line = parseLine(line, isAddLevel);
		}
		newLines.push(line);
	}
	var newSource = newLines.join("\n");
	return newSource;
}

/**
 * 修改heading级别
 * 这里主要处理选中的逻辑
 * @param {*} isAddLevel, true: 增加#号, false: 减少#号
 */
function changeHeadingLevel(isAddLevel) {
    const cm = getCMEditor()
	var selection = getSelection()
	selectAfterAppended()
	var newSource = changeHeadingLevelForString(cm, selection, isAddLevel);
	if (newSource) {
		cm.replaceSelection(newSource);
	} else {
		cm.replaceSelection(selection);
	}
}


//#endregion

//#region list相关

//list的帮助方法
const listHelper = {
	/**
	 * 只有空格和-, 没有内容;
	 * @param {*} line 
	 */
	isEmptyListItem: function (line) {
		return line && /^\s*-\s*$/.test(line);
	},
	/**
	 * 是list, 只支持-的格式; 
	 */
	isListItem: function (line) {
		return line && /^\s*-\s+/.test(line);
	},
	/**
	 * 是task
	 */
	isTaskItem: function (line) {
		return line && /^\s*-\s+\[[ x]\]\s+/.test(line);
	},
	/**
	 * 获取列表的内容,返回数组,包含两个元素, 列表的前半部分和内容, 如:["  - ","内容"]
	 * @param {string} line
	 */
	getListContentArray: function (line) {
		let match = line.match(/^(\s*-\s*)(.*)/)
		if (match) {
			return [match[1], match[2]];
		}
		return null;
	},
	/**
	 * 判断多行的字符串是list
	 * 可以用于粘贴时判断剪贴板里的内容是list
	 * @param {多行字符串} content 
	 */
	isListString: function (content) {
		//目前的逻辑: 首行是list就是list;
		content = content || "";
		return listHelper.isListItem(content.trim());
	},
}


/**
 * 切换list的完成状态
 * 添加或移除删除线
 * @returns 
 */
function toggleListDone() {
	const cm = getCMEditor()
	if (!cm.somethingSelected()) {
		//obsidian-tasks-plugin:toggle-done
		const line = getSelection()
		const isTaskItem = listHelper.isTaskItem(line)
		if (isTaskItem) {
			app.commands.executeCommandById("obsidian-tasks-plugin:toggle-done")
			return;
		}
	}

	let selection = getSelection();
	selectAfterAppended()
	var selectionArray = selection.split("\n");
	//先判断是添加还是移除删除线; 根据不是空行的第一行判断;
	let isAddMark = false
	for (let line of selectionArray) {
		if (!line.trim()) {
			continue
		}
		const arr = getPrefixContentArray(line)
		if (arr[1].startsWith("~~")) {
			isAddMark = false;
		} else {
			isAddMark = true;
		}
		break
	}
	//处理每行
	let newLineArray = []
	for (let line of selectionArray) {
		let array = getPrefixContentArray(line);
		let prefix = array[0];
		let content = array[1].trim();
		//如果内容已经有删除线了, 去除删除线; 
		if (isAddMark) {
			if (!content.startsWith("~~")) {
				content = `~~${content}~~`;
			}
		} else {
			if (content.startsWith("~~") && content.endsWith("~~")) {
				content = content.substring(2, content.length - 2);
			}
		}
		let newLine = prefix + content;
		newLineArray.push(newLine)
	}
	//替换选择
	cm.replaceSelection(newLineArray.join('\n'))
}


/**
 * 把一行分割为前缀和内容, 比如:['- ','list item']、['## ','heading item']、['','total line']
 * @param {*} line 一行文字
 * @returns 两个元素的数组; [prefix,content] 
 */
function getPrefixContentArray(line) {
	if (listHelper.isListItem(line)) {
		let array = listHelper.getListContentArray(line);
		return array;
	}
	// heading
	let headingMatch = line.match(/^(#+\s+)(.*)/)
	if (headingMatch) {
		return [headingMatch[1], headingMatch[2]];
	}
	//普通的一行; 
	return ["", line]

}

/**
 * 切换list的ul(unorder list)状态
 */
function toggleUL() {
	//从list-ul复制过来修改; 
	//切换当前行的list的状态; 
	const cm = getCMEditor()
	let selection = getSelection();
	selectAfterAppended()
	var selectionText = selection.split("\n");
	console.debug('selectionText', selectionText)
	for (var i = 0, len = selectionText.length; i < len; i++) {
		let line = selectionText[i];
		if (!listHelper.isListItem(line) && line !== "") {  //多行时不转换空行
			// line = "- " + line;
			line = line.replace(/(^\s*)/, "$1- "); //考虑以空格开头的情况
		} else {
			line = line.replace("- ", "");
		}
		selectionText[i] = line;
	}
	cm.replaceSelection(selectionText.join("\n"));
}

/**
 * 注册事件, 自动选择list的下级;
 */
function registerSmartListSelect() {
	console.debug('registerSmartListSelect')
	//先移除, 避免重复注册
	document.removeEventListener("selectionchange", window.onSelectionChangeQxx);
	window.onSelectionChangeQxx = onListSelectionChange
	document.addEventListener('selectionchange', window.onSelectionChangeQxx);
}

/**
 * list智能选择下级
 * @param {*} e 
 * @returns 
 */
function onListSelectionChange(e) {
	// console.log('qxx selectionchange start', e);
	const cm = getCMEditor()
	//anchor也叫from, 固定的位置; head也叫to, 移动的位置;
	const anchorOrigin = cm.getCursor("anchor")
	const headOrigin = cm.getCursor("head")
	const anchorNew = cm.getCursor("anchor")
	const headNew = cm.getCursor("head")
	if (anchorNew.line == headNew.line) {
		return;
	}

	// 根据开始选择的位置判断是否是list
	let anchorLine = cm.getLine(anchorNew.line);
	let anchorLineNext = cm.getLine(anchorNew.line+1);
	if (!listHelper.isListItem(anchorLine) && !listHelper.isListItem(anchorLineNext)) {
		return;
	}
	// console.debug({ anchor, head })
	if (headNew.line == anchorNew.line) {
		//同一行内复制
		return;
	} else if (headNew.line < anchorNew.line) {
		//向上复制, 简单处理, 只选中整行;
		// console.debug("qxx selectionchange up");
		anchorNew.ch = cm.getLine(anchorNew.line).length;
		headNew.ch = 0;
	} else {
		//向下复制
		//原理: 根据开始行(anchor)的缩进判断结束行(head)的范围; 
		// console.debug("qxx selectionchange down");
		anchorNew.ch = 0;
		let anchorLine = cm.getLine(anchorNew.line);
		let anchorLineSpace = getIndentSpaceCount(cm, anchorLine);
		let nextLineNo = headNew.line + 1;
		while (true) {
			let nextLine = cm.getLine(nextLineNo);
			let nextLineSpace = getIndentSpaceCount(cm, nextLine);
			if (nextLineSpace > anchorLineSpace) {
				nextLineNo += 1;
			} else {
				if (nextLineNo > headNew.line) {
					headNew.line = nextLineNo - 1;
				}
				//选择到head所在行的最后一个字符
				headNew.ch = cm.getLine(headNew.line).length;
				break;
			}
		}
	}
	if (!(
		anchorNew.line == anchorOrigin.line &&
		anchorNew.ch == anchorOrigin.ch &&
		headNew.line == headOrigin.line &&
		headNew.ch == headOrigin.ch
	)) {
		cm.setSelection(anchorNew, headNew)
	}
}

/**
 * 缩进list的级别, 顶级的替换为heading2, 其他的减小一个缩进
 * @returns 
 */
function decreaseIndentOfList() {
	const cm = getCMEditor()
	var selection = cm.getSelection();
	if (!selection) {
		return
	}
	selectAfterAppended()
	selection = selection.replace(/^- /gm, "\n## ")
	selection = selection.replace(/^\t/gm, "")
	selection = selection.replace(/^    /gm, "")
	cm.replaceSelection(selection)
}

//#endregion

//#region 系统命令

async function gitLog(tp, tR) {
	const msgs = await tp.user.qxx_bash({ cmd: "git log --pretty=format:'%s' -8" })
	const array = msgs.split("\n");;
	await tp.system.suggester(array, array)
}

//#endregion

//#region 大纲目录树

/**
 * disable quite outline's dragging shadow
 */
function improveQuiteOutlineShadow(){
	console.debug('qxx improveQuiteOutlineShadow')
	const elements = document.querySelectorAll(".quiet-outline .n-tree-node.n-tree-node--selectable")
	Array.from(elements).forEach(function(element) {
		element.addEventListener("dragstart", function(e) {
			var img = document.createElement("img");
			// img.src = "http://kryogenix.org/images/hackergotchi-simpler.png";
			e.dataTransfer.setDragImage(img, 0, 0);
		}, false);
	});	
}

/**
 * 光标放到heading上, outline滚动到对应heading
 * @returns null
 */
 function scrollToOutline() {
	const cm = getCMEditor()
	const selection = getSelection(cm)
	const arr = getPrefixContentArray(selection)
	if (!arr[0].startsWith("#")) {
		showMsg("not select heading")
		return
	}
	const heading = arr[1].trim();
    // 隐藏时style="display: none;", 显示时style为空
    // const parentSelector = '.workspace-leaf[style=""] '
    const parentSelector = '.workspace-leaf:not([style*="display: none"]) '
	const nodes1 = document.querySelectorAll(parentSelector+".outline .tree-item-self.is-clickable")
	const nodes2 = document.querySelectorAll(parentSelector+".quiet-outline .n-tree-node-content")
    const nodes = [...nodes1,...nodes2]
	for (let i = 0; i < nodes.length; i++) {
		const node = nodes[i];
		let text = node.innerText.trim();
		if (text == heading || `~~${text}~~` == heading) {
			// app.commands.executeCommandById("outline:open")
			let scrollIndex = Math.max(i - 10, 0)
			nodes[scrollIndex].scrollIntoView()
			// highlight
			node.addClass('is-flashing')
			showMsg("highlighting")
			setTimeout(() => {
				// remove highlight
				node.removeClass("is-flashing")
			}, 10000);
			return;
		}
	}
	showMsg("no node match")
}
//#endregion

//#region 其他
function removeEmptyLine() {
	const editor = getCMEditor()
	let selection = editor.getSelection();
	if (!selection) {
		//select all
		let startPos = { line: 0, ch: 0 }
		let endPos = { line: 9999, ch: 0 }
		editor.setSelection(startPos, endPos);
		selection = editor.getSelection();
	}
	let newSelection = selection;
	selectAfterAppended()
	newSelection = newSelection.replace(/\n[ \t]+\n/gm, "\n\n")
	newSelection = newSelection.replace(/\n\n\n*/gm, "\n\n")
	// 空行加两个空格
	// newSelection = newSelection.replace(/\n\n/g,"\n  \n")
	if (selection != newSelection) {
		const oldNum = selection.split("\n").length
		const newNum = newSelection.split("\n").length
		const msg = `removeEmptyLine: ${oldNum} - ${newNum} = ${oldNum - newNum}`
		showMsg(msg, 6000)
	} else {
		showMsg("nothing changes")
	}
	editor.replaceSelection(newSelection);
}

function startup(tp) {
	console.debug('startup')
	registerSmartListSelect()
}

//#endregion

//#region export

function exportAll() {
	let all = {
		test,
		log,
		changeHeadingUp: function () { changeHeadingLevel(false) },
		changeHeadingDown: function () { changeHeadingLevel(true) },
		toggleListDone,
		toggleUL,
		gitLog,
		startup,
		registerSmartListSelect,
		decreaseIndentOfList,
		removeEmptyLine,
		scrollToOutline,
	};
	return all;
};

//必须export函数; 
module.exports = exportAll;

//#endregion

//#region 测试函数
async function testSystemCmd(tp, tR) {
	const ls = await tp.user.qxx_ls()
	console.debug('test ls:', ls)
	const echo = await tp.user.qxx_echo({ msg: "传递的参数" })
	console.debug('test echo ', echo)

	const cmd = await tp.user.qxx_bash({ cmd: "echo 000" })
	console.debug('test cmd: ', cmd)
}

function testSelectAfterAppended() {
	selectAfterAppended()
	var selection = cm.getSelection();
	let newSource = selection + "-"
	cm.replaceSelection(newSource);
}


async function test(tp, tR) {
	showMsg("qxx test")
	const cm = getCMEditor()
	console.debug('test', this, { cm, tp, tR })

	//test 
	if (1 == 1) {
		// registerSmartListSelect()
		improveQuiteOutlineShadow()
		// scrollToOutline()
	}
	//select all
	if (1 == 2) {
		console.debug('test', cm)
		let startPos = { line: 0, ch: 0 }
		let endPos = { line: 9999, ch: 0 }
		cm.setSelection(startPos, endPos);
		selectAfterAppended()
	}
	if (1 == 2) {
		const line = getSelection()
		const b = listHelper.isTaskItem(line)
		console.debug('test', b)
	}
	//test 选择 setSelection
	if (1 == 2) {
		// let startPos = { line: 1, ch: 0 }
		// let endPos = { line: 2, ch: 0 }
		// cm.setSelection(startPos, endPos);
		// selectAfterAppended()

		// app.plugins.plugins['templater-obsidian'].registerDomEvent(document, 'selectionchange', (evt) => {
		// 	onSelectionChange(evt);
		// 	window.onchanged = true;
		// });
	}

	// await gitLog(tp,tR);

	//test 执行command
	if (1 == 2) {
		// app.commands.executeCommandById("insert-current-time")
		// console.debug('app.commands.commands', app.commands.commands)
	}

	// test 获取文件的link信息
	if (1 == 2) {
		let file = tp.file.find_tfile("obtest")
		console.debug('test file', file)
		let cache = app.metadataCache.getFileCache(file);
		let backlinks = app.metadataCache.getBacklinksForFile(file)
		console.debug('test backlinks', backlinks)

	}
}
//#endregion
