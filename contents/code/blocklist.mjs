import { Queue } from "./queue.mjs";

export class Blocklist {
  constructor(config) {
    this.config = config;
    this.appsBlockByShortcut = new Queue();
  }

  //Add new blocked apps
  addWindow(window) {
    return this.appsBlockByShortcut.add(window);
  }

  //Remove blocked apps
  removeWindow(window) {
    return this.appsBlockByShortcut.remove(window);
  }

  toggleWindow(window) {
    const isDeleted = this.removeWindow(window);

    if (isDeleted === false) {
      this.addWindow(window);
    }

    return !isDeleted;
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
      this.appsBlockByShortcut.exists(window) === true
    );
  }
}
