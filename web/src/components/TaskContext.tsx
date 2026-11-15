import { Show } from 'solid-js';
import type { Task } from '../services/api';

/** The API supplies context even when the parent is outside today's filtered list. */
export function TaskContext(props: { task: Task }) {
  return <Show when={props.task.parent_task_id || props.task.subtask_count}>
    <span class="task-context">
      <Show when={props.task.parent_task_id}>Subtask · {props.task.parent_title || 'Parent task'}</Show>
      <Show when={!props.task.parent_task_id && props.task.subtask_count}>{props.task.subtask_done || 0}/{props.task.subtask_count} subtask selesai</Show>
    </span>
  </Show>;
}
