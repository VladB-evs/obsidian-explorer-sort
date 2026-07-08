import { TAbstractFile, TFolder, View } from "obsidian";

/** An entry rendered in the file explorer (internal Obsidian API). */
export interface FileItem {
	file: TAbstractFile;
	el?: HTMLElement;
}

/** The internal file explorer view (not part of the public API). */
export interface FileExplorerView extends View {
	fileItems: Record<string, FileItem>;
	getSortedFolderItems?(folder: TFolder): FileItem[];
	requestSort(): void;
}

export interface ExplorerSortData {
	enabled: boolean;
	/**
	 * Custom order per folder: folder path -> ordered list of child names.
	 * Children missing from the list are appended in Obsidian's default order.
	 */
	orders: Record<string, string[]>;
}

export const DEFAULT_DATA: ExplorerSortData = {
	enabled: true,
	orders: {},
};
