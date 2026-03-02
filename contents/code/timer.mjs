export class Timer {
  constructor(root, timerInstantiator) {
    this.root = root;
    this.timerInstantiator = timerInstantiator;
  }

  start(id, customFunction, delay = 0) {
    const functionTrigger = (id) => {
      customFunction();
      this.root.timers = this.root.timers.filter((t) => t.id !== id);
    };

    const job = {
      id,
      delay,
      functionTrigger: functionTrigger.bind(this, id),
    };

    const index = this.root.timers.findIndex((t) => t.id === id);

    if (index !== -1) {
      this.timerInstantiator.objectAt(index)?.restart();
      return;
    }

    this.root.timers = [...this.root.timers, job];
  }
}
