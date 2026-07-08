import { App, Modal, Setting, TFolder } from "obsidian";
import type ExplorerSortPlugin from "./main";

/**
 * A modal listing the children of a folder, reorderable via drag and drop
 * (or with per-row up/down buttons as a keyboard-friendly fallback).
 */
export class ReorderModal extends Modal {
	private names: string[];
	private listEl: HTMLElement | null = null;
	private dragIndex = -1;

	constructor(
		app: App,
		private plugin: ExplorerSortPlugin,
		private folder: TFolder
	) {
		super(app);
		this.names = plugin.getDisplayedChildNames(folder);
	}

	onOpen() {
		this.titleEl.setText(
			`Reorder: ${this.folder.path === "/" ? "Vault root" : this.folder.path}`
		);
		this.contentEl.createEl("p", {
			text: "Drag items to rearrange them, then save.",
			cls: "explorer-sort-hint",
		});

		this.listEl = this.contentEl.createDiv({ cls: "explorer-sort-list" });
		this.renderList();

		new Setting(this.contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Reset to default sorting")
					.onClick(async () => {
						await this.plugin.clearOrder(this.folder);
						this.close();
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText("Save order")
					.setCta()
					.onClick(async () => {
						await this.plugin.setOrder(this.folder, this.names);
						this.close();
					})
			);
	}

	onClose() {
		this.contentEl.empty();
	}

	private renderList() {
		const list = this.listEl;
		if (!list) return;
		list.empty();

		const isFolder = (name: string) =>
			this.folder.children.find((c) => c.name === name) instanceof TFolder;

		this.names.forEach((name, index) => {
			const row = list.createDiv({ cls: "explorer-sort-row" });
			row.draggable = true;

			row.createSpan({ cls: "explorer-sort-grip", text: "⠿" });
			row.createSpan({
				cls: "explorer-sort-name",
				text: isFolder(name) ? `📁 ${name}` : name,
			});

			const controls = row.createDiv({ cls: "explorer-sort-controls" });
			const upBtn = controls.createEl("button", { text: "↑" });
			upBtn.disabled = index === 0;
			upBtn.addEventListener("click", () => this.moveTo(index, index - 1));
			const downBtn = controls.createEl("button", { text: "↓" });
			downBtn.disabled = index === this.names.length - 1;
			downBtn.addEventListener("click", () => this.moveTo(index, index + 1));

			row.addEventListener("dragstart", (evt) => {
				this.dragIndex = index;
				row.addClass("is-dragging");
				evt.dataTransfer?.setData("text/plain", name);
				if (evt.dataTransfer) evt.dataTransfer.effectAllowed = "move";
			});
			row.addEventListener("dragend", () => {
				this.dragIndex = -1;
				row.removeClass("is-dragging");
			});
			row.addEventListener("dragover", (evt) => {
				evt.preventDefault();
				if (this.dragIndex === -1 || this.dragIndex === index) return;
				row.addClass("is-drop-target");
			});
			row.addEventListener("dragleave", () => row.removeClass("is-drop-target"));
			row.addEventListener("drop", (evt) => {
				evt.preventDefault();
				row.removeClass("is-drop-target");
				if (this.dragIndex === -1 || this.dragIndex === index) return;
				this.moveTo(this.dragIndex, index);
			});
		});
	}

	private moveTo(from: number, to: number) {
		if (to < 0 || to >= this.names.length) return;
		const [moved] = this.names.splice(from, 1);
		this.names.splice(to, 0, moved);
		this.dragIndex = -1;
		this.renderList();
	}
}
