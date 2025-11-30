import { computed, Directive, input } from '@angular/core';
import { provideHlmIconConfig } from '../../../icon/src';
import { hlm } from '../../../utils/src';
import type { ClassValue } from 'clsx';

@Directive({
	selector: '[hlmCommandIcon]',
	providers: [provideHlmIconConfig({ size: 'sm' })],
	host: {
		'[class]': '_computedClass()',
	},
})
export class HlmCommandIcon {
	public readonly userClass = input<ClassValue>('', { alias: 'class' });
	protected readonly _computedClass = computed(() =>
		hlm('text-muted-foreground pointer-events-none shrink-0', this.userClass()),
	);
}
