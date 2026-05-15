// CommandManager: simple undo/redo stack
export class CommandManager {
  constructor(max = 200) {
    this.max = max;
    this.undoStack = [];
    this.redoStack = [];
  }
  execute(command) {
    command.execute();
    this.undoStack.push(command);
    if (this.undoStack.length > this.max) this.undoStack.shift();
    this.redoStack = [];
  }
  undo() {
    const cmd = this.undoStack.pop();
    if (!cmd) return;
    if (cmd.undo) cmd.undo();
    this.redoStack.push(cmd);
  }
  redo() {
    const cmd = this.redoStack.pop();
    if (!cmd) return;
    cmd.execute();
    this.undoStack.push(cmd);
  }
}

// Example base command pattern
export class BaseCommand {
  constructor(desc = '') { this.desc = desc; }
  execute() { throw new Error('execute not implemented'); }
  undo() { /* optional */ }
}
