import { type App, FuzzySuggestModal, type TFile } from 'obsidian'

export class NoteSelectorModal extends FuzzySuggestModal<TFile> {
  private onSelect: (file: TFile) => void

  constructor(app: App, onSelect: (file: TFile) => void) {
    super(app)
    this.onSelect = onSelect
    this.setPlaceholder('Search for a note to add as context...')
  }

  getItems(): TFile[] {
    return this.app.vault.getMarkdownFiles()
  }

  getItemText(file: TFile): string {
    return file.path
  }

  onChooseItem(file: TFile): void {
    this.onSelect(file)
  }
}
