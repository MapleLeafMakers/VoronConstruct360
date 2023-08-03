import { Dialog } from 'quasar';
import ErrorDialog from './components/ErrorDialog.vue';

export async function showAlert({ message }: { message: string }) {
  return Dialog.create({ component: ErrorDialog, componentProps: { message } });
}
