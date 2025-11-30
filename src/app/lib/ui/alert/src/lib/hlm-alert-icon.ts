import { Directive } from '@angular/core';
import { provideHlmIconConfig } from '../../../icon/src';

@Directive({
	selector: '[hlmAlertIcon]',
	providers: [provideHlmIconConfig({ size: 'sm' })],
})
export class HlmAlertIcon { }
