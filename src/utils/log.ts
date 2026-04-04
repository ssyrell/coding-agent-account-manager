import chalk from 'chalk'

export function info(msg: string): void {
  console.log(chalk.cyan('ℹ') + ' ' + msg)
}

export function success(msg: string): void {
  console.log(chalk.green('✓') + ' ' + msg)
}

export function warn(msg: string): void {
  console.warn(chalk.yellow('⚠') + ' ' + msg)
}

export function error(msg: string): void {
  console.error(chalk.red('✗') + ' ' + msg)
}

export function dim(msg: string): string {
  return chalk.dim(msg)
}

export function bold(msg: string): string {
  return chalk.bold(msg)
}
