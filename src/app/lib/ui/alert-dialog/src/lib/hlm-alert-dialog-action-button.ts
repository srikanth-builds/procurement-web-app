import { Directive } from '@angular/core';
import { HlmButton } from '../../../button/src';

@Directive({
	selector: 'button[hlmAlertDialogAction]',
	hostDirectives: [{ directive: HlmButton, inputs: ['variant', 'size'] }],
})
export class HlmAlertDialogActionButton { }
