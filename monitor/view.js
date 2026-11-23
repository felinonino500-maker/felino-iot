const { createApp, defineComponent, h, nextTick, onMounted, ref, watch } = Vue;

// ===== Komponen =====
const AppButton = defineComponent({
  name: 'AppButton',
  inheritAttrs: false,
  props: { variant: { type: String, default: 'primary' } },
  setup(props, { attrs, slots }) {
    const variants = {
      primary: 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
      danger: 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
      ghost: 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
    };
    return () => h('button', { ...attrs, class: [attrs.class, 'transition', variants[props.variant] || variants.primary] }, slots.default?.());
  },
});
const AppInput = defineComponent({
  name: 'AppInput',
  inheritAttrs: false,
  props: { label: { type: String, default: '' }, modelValue: { type: [String, Number], default: '' }, type: { type: String, default: 'text' } },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit }) {
    return () => h('input', {
      ...attrs, type: props.type, value: attrs.value ?? props.modelValue,
      onInput: (event) => emit('update:modelValue', event.target.value),
    });
  },
});
const AppCard = defineComponent({
  name: 'AppCard',
  inheritAttrs: false,
  props: { title: { type: String, default: '' } },
  setup(_props, { attrs, slots }) {
    return () => h('section', { ...attrs }, slots.default?.());
  },
});
const AppModal = defineComponent({
  name: 'AppModal',
  inheritAttrs: false,
  props: { show: { type: Boolean, default: false }, title: { type: String, default: '' } },
  emits: ['close'],
  setup(props, { attrs, emit, slots }) {
    const dialog = ref(null);
    watch(() => props.show, async (show) => {
      await nextTick();
      if (show && dialog.value && !dialog.value.open) dialog.value.showModal();
      if (!show && dialog.value?.open) dialog.value.close();
    });
    onMounted(() => { if (props.show) dialog.value?.showModal(); });
    return () => props.show ? h('dialog', {
      ...attrs, ref: dialog, class: ['help-dialog', attrs.class],
      onClose: () => emit('close'),
    }, [
      h('button', { type: 'button', class: 'dialog-close', 'aria-label': 'Tutup', onClick: () => dialog.value?.close() }, '×'),
      h('div', { class: 'section-kicker' }, 'QUICK GUIDE'),
      h('h2', props.title),
      ...(slots.default?.() || []),
    ]) : null;
  },
});
document.addEventListener('click', (event) => {
  if (event.target.closest('#flashHelp')) window.openFlashHelp?.();
});

async function mountPortal() {
  const response = await fetch('/app-view.html');
  if (!response.ok) throw new Error(`View gagal dimuat (${response.status}).`);
  const template = await response.text();
  const helpVisible = ref(false);
  window.openFlashHelp = () => { helpVisible.value = true; };
  createApp({
    setup() { return { helpVisible }; },
    template: `<div>${template}</div>`,
  })
    .component('app-button', AppButton)
    .component('app-input', AppInput)
    .component('app-card', AppCard)
    .component('app-modal', AppModal)
    .mount('#app');
  await import('/app.js');
}
mountPortal().catch((error) => {
  console.error(error);
  document.getElementById('app').textContent = 'Portal gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.';
});
