export class Shortcuts {
  constructor(workspace, root, { blocklist }) {
    this.shortcuts = [
      {
        title: "Fluid tile - Toggle window to blocklist",
        text: "Fluid tile - Toggle window to blocklist",
        keys: "Meta+F",
        callback: () => {
          console.log("shortcut executed");
          blocklist.toggleWindow(workspace.activeWindow);
        },
      },
    ];
    console.log(root);
    root.shortcuts = this.shortcuts;
  }
}
