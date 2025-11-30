import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrnTooltipContentTemplate } from '@spartan-ng/brain/tooltip';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmTooltip, HlmTooltipTrigger } from '@spartan-ng/helm/tooltip';

import { LucideAngularModule } from 'lucide-angular';

@Component({
    selector: 'app-chat-header',
    standalone: true,
    imports: [CommonModule, HlmTooltip, HlmTooltipTrigger, BrnTooltipContentTemplate, HlmButton, LucideAngularModule],
    templateUrl: './chat-header.component.html',
    styleUrl: './chat-header.component.scss'
})
export class ChatHeaderComponent {
    title = input.required<string>();
    newChat = output<void>();
    toggleHistory = output<void>();
}
