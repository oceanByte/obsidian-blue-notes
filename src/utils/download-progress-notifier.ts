import { Notice } from 'obsidian'

interface DownloadProgressNotifierOptions {
  items: string[]
  milestoneStep?: number
  noticeDurationMs?: number
  startMessage?: string
  completionMessage?: string
}

interface TaskProgress {
  weight: number
  percent: number
}

const DEFAULT_MILESTONE_STEP = 35
const DEFAULT_NOTICE_DURATION = 4000

function formatItemList(items: string[]): string {
  if (items.length === 0) {
    return 'downloads'
  }

  if (items.length === 1) {
    return items[0]
  }

  const [last, ...restReversed] = [...items].reverse()
  const rest = restReversed.reverse()
  return `${rest.join(', ')} and ${last}`
}

function clampPercent(value: number): number {
  if (Number.isNaN(value)) {
    return 0
  }
  return Math.max(0, Math.min(100, value))
}

/**
 * Provides milestone notices (35%, 70%, done) for long-running downloads.
 * Designed to unify progress feedback for runtime and model downloads.
 */
export class DownloadProgressNotifier {
  private readonly summary: string
  private readonly milestoneStep: number
  private readonly noticeDuration: number
  private readonly completionMessage: string
  private readonly tasks = new Map<string, TaskProgress>()
  private totalWeight = 0
  private nextMilestone: number
  private completedNotified = false
  private active = true

  constructor(options: DownloadProgressNotifierOptions) {
    this.summary = formatItemList(options.items)
    this.milestoneStep = options.milestoneStep ?? DEFAULT_MILESTONE_STEP
    this.noticeDuration = options.noticeDurationMs ?? DEFAULT_NOTICE_DURATION
    const startMessage = options.startMessage ?? `Downloading ${this.summary}...`
    this.completionMessage =
      options.completionMessage ?? `Finished downloading ${this.summary}.`

    new Notice(startMessage, this.noticeDuration)

    this.nextMilestone = this.milestoneStep
  }

  /**
   * Register a task that contributes to the overall progress calculation.
   * The task weight should represent its relative size (bytes, MB, etc.).
   */
  beginTask(taskId: string, weight = 1): void {
    if (this.tasks.has(taskId)) {
      return
    }

    const sanitizedWeight = Math.max(weight, 1)
    this.tasks.set(taskId, { weight: sanitizedWeight, percent: 0 })
    this.totalWeight += sanitizedWeight
  }

  /**
   * Update the relative weight of a task (useful when the actual size becomes known).
   */
  updateTaskWeight(taskId: string, weight: number): void {
    if (!this.active) {
      return
    }

    const task = this.tasks.get(taskId)
    if (!task) {
      return
    }

    const sanitizedWeight = Math.max(weight, 1)
    this.totalWeight += sanitizedWeight - task.weight
    task.weight = sanitizedWeight

    this.emitMilestones()
  }

  /**
   * Report progress for a task as a percentage (0-100).
   */
  reportProgress(taskId: string, percent: number): void {
    if (!this.active) {
      return
    }

    const task = this.tasks.get(taskId)
    if (!task) {
      return
    }

    task.percent = clampPercent(percent)
    this.emitMilestones()
  }

  /**
   * Mark a task as complete (100%).
   */
  completeTask(taskId: string): void {
    this.reportProgress(taskId, 100)
  }

  /**
   * Cancel further notifications (used when a download fails).
   */
  cancel(): void {
    this.active = false
  }

  private getOverallPercent(): number {
    if (this.tasks.size === 0) {
      return 0
    }

    if (this.totalWeight > 0) {
      let weightedSum = 0
      for (const task of this.tasks.values()) {
        weightedSum += task.percent * task.weight
      }
      return clampPercent(weightedSum / this.totalWeight)
    }

    let sum = 0
    for (const task of this.tasks.values()) {
      sum += task.percent
    }
    return clampPercent(sum / this.tasks.size)
  }

  private emitMilestones(): void {
    if (!this.active) {
      return
    }

    const percent = this.getOverallPercent()

    while (this.nextMilestone <= 90 && percent >= this.nextMilestone) {
      new Notice(
        `${this.nextMilestone}% of ${this.summary} downloaded`,
        this.noticeDuration,
      )
      this.nextMilestone += this.milestoneStep
    }

    if (percent >= 100 && !this.completedNotified) {
      new Notice(this.completionMessage, this.noticeDuration)
      this.completedNotified = true
      this.active = false
    }
  }
}
