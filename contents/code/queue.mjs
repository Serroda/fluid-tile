export class Queue {
  constructor() {
    this.queue = [];
  }

  exists(item) {
    return this.queue.includes(item);
  }

  add(item) {
    if (item === undefined || this.exists(item) === true) {
      return false;
    }

    this.queue.push(item);
  }

  remove(item) {
    if (item === undefined || this.exists(item) === false) {
      return false;
    }

    this.queue.splice(this.queue.indexOf(item), 1);

    return true;
  }
}
