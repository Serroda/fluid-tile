export class Blocklist {
  constructor(config) {
    this.config = config;
    this.appsBlockByShortcut = [];
  }

  //Add new blocked apps
  addWindow(window) {
    this.appsBlockByShortcut.push(window);
  }

  //Remove blocked apps
  removeWindow(window) {
    const index = this.appsBlockByShortcut.findIndex((abs) => abs === window);
    if (index !== -1) {
      this.appsBlockByShortcut.splice(index, 1);
    }
  }

  // Check if the app is in the blocklist or not valid
  check(window) {
    return (
      window.normalWindow === false ||
      window.resizeable === false ||
      window.maximizable === false ||
      (this.config.modalsIgnore === true ? window.transient === true : false) ||
      this.config.appsBlocklist
        .toLowerCase()
        .includes(window.resourceClass.toLowerCase()) === true ||
      this.appsBlockByShortcut.includes(window) === true
    );
  }
}
