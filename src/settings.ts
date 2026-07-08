import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type ExplorerSortPlugin from "./main";

export class ExplorerSortSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: ExplorerSortPlugin) {
		super(app, plugin);
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Enable custom sorting")
			.setDesc(
				"When enabled, folders with a saved custom order are displayed in that order. " +
					"Items without a saved position (e.g. newly created files) are appended at the bottom."
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.data.enabled).onChange(async (value) => {
					this.plugin.data.enabled = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Custom orders")
			.setDesc(
				`${Object.keys(this.plugin.data.orders).length} folder(s) currently have a custom order. ` +
					"Right-click a file or folder in the explorer to move it, or use " +
					"“Reorder folder contents…” for drag-and-drop."
			)
			.addButton((btn) =>
				btn
					.setButtonText("Clear all custom orders")
					.setWarning()
					.onClick(async () => {
						await this.plugin.clearAllOrders();
						new Notice("Explorer Sort: all custom orders cleared");
						this.display();
					})
			);
	}
}
