import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HlmToaster } from './lib/ui/sonner/src';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HlmToaster],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('angular-tailwind');
}
