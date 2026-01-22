export class Queue {
  constructor() {
    this.queue = [];
  }

  exists(item) {
    return this.queue.includes(item);
  }

  add(item) {
    if (this.exists(item) === true) {
      return false;
    }

    this.queue.push(item);
  }

  remove(item) {
    if (this.exists(item) === false) {
      return false;
    }

    this.queue.splice(this.queue.indexOf(item), 1);

    return true;
  }
}
