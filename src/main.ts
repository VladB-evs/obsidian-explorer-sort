import {
	Menu,
	Notice,
	Plugin,
	TAbstractFile,
	TFolder,
	WorkspaceLeaf,
} from "obsidian";
import { around } from "monkey-around";
import { DEFAULT_DATA, ExplorerSortData, FileExplorerView, FileItem } from "./types";
import { ReorderModal } from "./reorderModal";
import { ExplorerSortSettingTab } from "./settings";

export default class ExplorerSortPlugin extends Plugin {
	data: ExplorerSortData = DEFAULT_DATA;
	private uninstallPatch: (() => void) | null = null;

	async onload() {
		this.data = Object.assign({}, DEFAULT_DATA, await this.loadData());
		this.data.orders = this.data.orders ?? {};

		this.addSettingTab(new ExplorerSortSettingTab(this.app, this));
		this.registerFileMenu();
		this.registerVaultEvents();
		this.registerCommands();

		this.app.workspace.onLayoutReady(() => {
			if (!this.patchFileExplorer()) {
				// The explorer pane may not exist yet (e.g. it was closed).
				// Keep trying whenever the layout changes.
				const evt = this.app.workspace.on("layout-change", () => {
					if (this.patchFileExplorer()) {
						this.app.workspace.offref(evt);
					}
				});
				this.registerEvent(evt);
			}
		});
	}

	onunload() {
		this.uninstallPatch?.();
		this.uninstallPatch = null;
		this.requestExplorerSort();
	}

	// ------------------------------------------------------------------
	// Patching the file explorer
	// ------------------------------------------------------------------

	private getExplorerView(): FileExplorerView | null {
		const leaf: WorkspaceLeaf | undefined =
			this.app.workspace.getLeavesOfType("file-explorer")[0];
		return (leaf?.view as FileExplorerView) ?? null;
	}

	/** Returns true once the explorer view has been patched. */
	private patchFileExplorer(): boolean {
		if (this.uninstallPatch) return true;
		const view = this.getExplorerView();
		if (!view) return false;

		const proto = Object.getPrototypeOf(view) as FileExplorerView;
		if (typeof proto.getSortedFolderItems !== "function") {
			console.warn(
				"[Explorer Sort] This Obsidian version does not expose getSortedFolderItems; custom sorting is unavailable."
			);
			return true;
		}

		const plugin = this;
		this.uninstallPatch = around(proto as unknown as Record<string, unknown>, {
			getSortedFolderItems(old: (folder: TFolder) => FileItem[]) {
				return function (this: FileExplorerView, folder: TFolder) {
					const items = old.call(this, folder);
					if (!plugin.data.enabled) return items;
					const order = plugin.data.orders[folder.path];
					if (!order || order.length === 0) return items;
					return plugin.applyOrder(items, order);
				};
			},
		});
		this.register(() => {
			this.uninstallPatch?.();
			this.uninstallPatch = null;
		});
		this.requestExplorerSort();
		return true;
	}

	/**
	 * Reorders explorer items: names present in `order` come first (in that
	 * order); anything else (e.g. newly created files) keeps Obsidian's
	 * default order and is appended at the end.
	 */
	applyOrder(items: FileItem[], order: string[]): FileItem[] {
		const position = new Map<string, number>();
		order.forEach((name, i) => position.set(name, i));

		const known: FileItem[] = [];
		const unknown: FileItem[] = [];
		for (const item of items) {
			if (position.has(item.file.name)) known.push(item);
			else unknown.push(item);
		}
		known.sort(
			(a, b) =>
				(position.get(a.file.name) ?? 0) - (position.get(b.file.name) ?? 0)
		);
		return known.concat(unknown);
	}

	requestExplorerSort() {
		const view = this.getExplorerView();
		view?.requestSort?.();
	}

	// ------------------------------------------------------------------
	// Order manipulation
	// ------------------------------------------------------------------

	/** The children of a folder in the order they are currently displayed. */
	getDisplayedChildNames(folder: TFolder): string[] {
		const view = this.getExplorerView();
		if (view?.getSortedFolderItems) {
			return view.getSortedFolderItems(folder).map((i) => i.file.name);
		}
		return folder.children.map((c) => c.name);
	}

	async setOrder(folder: TFolder, names: string[]) {
		this.data.orders[folder.path] = names;
		await this.saveData(this.data);
		this.requestExplorerSort();
	}

	async clearOrder(folder: TFolder) {
		delete this.data.orders[folder.path];
		await this.saveData(this.data);
		this.requestExplorerSort();
	}

	async clearAllOrders() {
		this.data.orders = {};
		await this.saveData(this.data);
		this.requestExplorerSort();
	}

	async saveSettings() {
		await this.saveData(this.data);
		this.requestExplorerSort();
	}

	/**
	 * Moves a file/folder within its parent.
	 * `target` is either a relative step or an absolute edge.
	 */
	async moveItem(file: TAbstractFile, target: "up" | "down" | "top" | "bottom") {
		const parent = file.parent;
		if (!parent) return;

		const names = this.getDisplayedChildNames(parent);
		const index = names.indexOf(file.name);
		if (index === -1) return;

		names.splice(index, 1);
		let newIndex: number;
		switch (target) {
			case "up":
				newIndex = Math.max(0, index - 1);
				break;
			case "down":
				newIndex = Math.min(names.length, index + 1);
				break;
			case "top":
				newIndex = 0;
				break;
			case "bottom":
				newIndex = names.length;
				break;
		}
		names.splice(newIndex, 0, file.name);
		await this.setOrder(parent, names);
	}

	// ------------------------------------------------------------------
	// UI hooks
	// ------------------------------------------------------------------

	private registerFileMenu() {
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile) => {
				if (!this.data.enabled || !file.parent) return;
				const parent = file.parent;

				menu.addSeparator();
				menu.addItem((item) =>
					item
						.setTitle("Move up")
						.setIcon("arrow-up")
						.setSection("explorer-sort")
						.onClick(() => this.moveItem(file, "up"))
				);
				menu.addItem((item) =>
					item
						.setTitle("Move down")
						.setIcon("arrow-down")
						.setSection("explorer-sort")
						.onClick(() => this.moveItem(file, "down"))
				);
				menu.addItem((item) =>
					item
						.setTitle("Move to top")
						.setIcon("arrow-up-to-line")
						.setSection("explorer-sort")
						.onClick(() => this.moveItem(file, "top"))
				);
				menu.addItem((item) =>
					item
						.setTitle("Move to bottom")
						.setIcon("arrow-down-to-line")
						.setSection("explorer-sort")
						.onClick(() => this.moveItem(file, "bottom"))
				);
				menu.addItem((item) =>
					item
						.setTitle("Reorder folder contents…")
						.setIcon("list-ordered")
						.setSection("explorer-sort")
						.onClick(() => {
							const folder = file instanceof TFolder ? file : parent;
							new ReorderModal(this.app, this, folder).open();
						})
				);
			})
		);
	}

	private registerCommands() {
		const moveCommand = (
			id: string,
			name: string,
			target: "up" | "down" | "top" | "bottom"
		) => {
			this.addCommand({
				id,
				name,
				checkCallback: (checking) => {
					const file = this.app.workspace.getActiveFile();
					if (!file || !file.parent) return false;
					if (!checking) void this.moveItem(file, target);
					return true;
				},
			});
		};
		moveCommand("move-active-file-up", "Move active file up in explorer", "up");
		moveCommand("move-active-file-down", "Move active file down in explorer", "down");
		moveCommand("move-active-file-top", "Move active file to top of its folder", "top");
		moveCommand("move-active-file-bottom", "Move active file to bottom of its folder", "bottom");

		this.addCommand({
			id: "reorder-current-folder",
			name: "Reorder contents of active file's folder",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || !file.parent) return false;
				if (!checking) new ReorderModal(this.app, this, file.parent).open();
				return true;
			},
		});

		this.addCommand({
			id: "toggle-custom-sorting",
			name: "Toggle custom sorting on/off",
			callback: async () => {
				this.data.enabled = !this.data.enabled;
				await this.saveSettings();
				new Notice(
					`Explorer Sort: custom sorting ${this.data.enabled ? "enabled" : "disabled"}`
				);
			},
		});
	}

	// ------------------------------------------------------------------
	// Keeping stored orders in sync with vault changes
	// ------------------------------------------------------------------

	private registerVaultEvents() {
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				void this.handleRename(file, oldPath);
			})
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				void this.handleDelete(file);
			})
		);
	}

	private parentPathOf(path: string): string {
		const idx = path.lastIndexOf("/");
		return idx === -1 ? "/" : path.substring(0, idx);
	}

	private nameOf(path: string): string {
		const idx = path.lastIndexOf("/");
		return idx === -1 ? path : path.substring(idx + 1);
	}

	private async handleRename(file: TAbstractFile, oldPath: string) {
		let changed = false;
		const oldParentPath = this.parentPathOf(oldPath);
		const oldName = this.nameOf(oldPath);
		const newParentPath = file.parent?.path ?? "/";

		// Remap order keys for the renamed/moved folder and its descendants.
		if (file instanceof TFolder) {
			const prefix = oldPath + "/";
			for (const key of Object.keys(this.data.orders)) {
				if (key === oldPath || key.startsWith(prefix)) {
					const newKey = file.path + key.substring(oldPath.length);
					this.data.orders[newKey] = this.data.orders[key];
					delete this.data.orders[key];
					changed = true;
				}
			}
		}

		const oldParentOrder = this.data.orders[oldParentPath];
		if (oldParentOrder) {
			const idx = oldParentOrder.indexOf(oldName);
			if (idx !== -1) {
				if (oldParentPath === newParentPath) {
					// Renamed in place: keep its position under the new name.
					oldParentOrder[idx] = file.name;
				} else {
					// Moved to another folder: drop it from the old order.
					oldParentOrder.splice(idx, 1);
				}
				changed = true;
			}
		}

		if (changed) {
			await this.saveData(this.data);
			this.requestExplorerSort();
		}
	}

	private async handleDelete(file: TAbstractFile) {
		let changed = false;

		const prefix = file.path + "/";
		for (const key of Object.keys(this.data.orders)) {
			if (key === file.path || key.startsWith(prefix)) {
				delete this.data.orders[key];
				changed = true;
			}
		}

		const parentPath = this.parentPathOf(file.path);
		const parentOrder = this.data.orders[parentPath];
		if (parentOrder) {
			const idx = parentOrder.indexOf(file.name);
			if (idx !== -1) {
				parentOrder.splice(idx, 1);
				changed = true;
			}
		}

		if (changed) await this.saveData(this.data);
	}
}
