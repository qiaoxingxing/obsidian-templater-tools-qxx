
# 功能介绍
这是obsidian templater插件的脚本, 主要包括以下功能: 
- 大纲(列表)增强
	- 批量切换已完成/未完成状态
	- 批量切换列表/非列表的状态
	- 快速选择: 选中父节点下拉, 同时选中所有子节点
	- 减小缩进: 顶级节点转为标题, 子节点减少缩进
- 批量调整标题(heading)的级别
- 批量切换列表、小标题、单行的"完成"状态
- 在目录插件(outline)中滚动、高亮当前标题的位置

# 使用方法
安装和配置:
1. 安装obsidian templater插件
2. 在obsidian里创建脚本的存放的文件夹, 比如`Templates/scripts`, 后文按照这个文件夹举例
3. 把本项目scripts文件夹里的所有文件拷贝到`Templates/scripts`
4. 设置templater
	1. 设置Template folder location: `Templates/scripts`
	2. 设置Startup Templaters: "src-startup.md"文件, 路径为`Templates/scripts/src-startup.md`
	3. 设置User Script Functions: `Templates/scripts`

使用:  
使用方法1: 推荐, 插件设置的『Template hotkeys』, 给脚本逐个添加快捷键  
使用方法2: 打开命令面板 -> Templater: open instert tempalte modal(Alt+E) -> 选择具体脚本

# 脚本文件说明

## qxx_script.js
- qxx_script.js: 包含所有实现功能的js代码
- `*.md`: 调用qxx_script.js里的函数, 完成特定功能, 一般一个函数对应一个md文件;

## src-changeheadinglevel-down/up.md
- 批量调整选中内容的标题(heading)的级别  
- src-changeheadinglevel-down.md, 提高级别,减少`#`号  
- src-changeheadinglevel-up.md, 降低级别,增加`#`号

## src-toggleUL.md
批量切换选中行的列表/非列表的状态

## src-list-done.md
- 批量切换已完成/未完成状态;『完成状态』表示添加删除线`~~`
- 批量切换列表、标题、单行的状态切换
- 推荐绑定快捷键ctrl+enter

## src-startup.md
templater启动时会执行的脚本, 目前只执行了`registerSmartListSelect()`(注册大纲选择增强)  
registerSmartListSelect()函数配合onListSelectionChange(), 实现快速选择: 选中父节点同时选中子节点;

## src-decrease-list.md
批量减小选中列表的缩进: 顶级节点转为二级标题, 子节点减少缩进

## src-scroll-outline.md
在正文点击标题, 把光标移动到标题所在行, 执行脚本后, 会在目录插件(outline)中滚动、高亮当前标题的位置
