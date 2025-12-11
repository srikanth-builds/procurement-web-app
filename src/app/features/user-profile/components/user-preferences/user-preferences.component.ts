import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ThemeService } from '../../../../core/services/theme.service';
import { UserProfileService } from '../../../../core/services/user-profile.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-user-preferences',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './user-preferences.component.html',
})
export class UserPreferencesComponent {
  
  private fb = inject(FormBuilder);
  private themeService = inject(ThemeService);
  private userProfileService = inject(UserProfileService);

  preferencesForm: FormGroup;
  
  // State Signals
  isLoading = signal(true);
  loadingError = signal<string | null>(null);
  isSaving = signal(false);
  saveMessage = signal('');

  constructor() {
    this.preferencesForm = this.fb.group({
      theme: ['light'], // Default, will be updated from input or service
      notifications_email: [true],
      notifications_push: [false],
      custom_instructions: ['']
    });

    // Fetch latest preferences
    this.loadPreferences();

    // Sync theme changes immediately for preview
    this.preferencesForm.get('theme')?.valueChanges.subscribe(value => {
        if (value === 'dark' && !this.themeService.darkMode()) {
            this.themeService.toggleTheme();
        } else if (value === 'light' && this.themeService.darkMode()) {
            this.themeService.toggleTheme();
        }
    });
  }

  loadPreferences() {
    this.isLoading.set(true);
    this.loadingError.set(null);

    this.userProfileService.getPreferences()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (prefs) => {
          if (prefs) {
            this.preferencesForm.patchValue({
              theme: prefs['theme'] || (this.themeService.darkMode() ? 'dark' : 'light'),
              notifications_email: prefs['notifications_email'] ?? true,
              notifications_push: prefs['notifications_push'] ?? false,
              custom_instructions: prefs['custom_instructions'] || ''
            }, { emitEvent: false });
          }
        },
        error: (err) => {
          console.error('Failed to load preferences', err);
          const detail = err.error?.detail || err.message || 'Failed to load preferences. Please try again.';
          this.loadingError.set(detail);
        }
      });
  }

  savePreferences() {
    if (this.preferencesForm.invalid) return;

    this.isSaving.set(true);
    this.saveMessage.set('');
    
    const formValue = this.preferencesForm.value;
    
    // Ensure theme service is synced if it wasn't already (redundant but safe)
    const isDark = formValue.theme === 'dark';
    if (isDark !== this.themeService.darkMode()) {
        this.themeService.toggleTheme();
    }

    this.userProfileService.updatePreferences(formValue)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.saveMessage.set('Preferences saved successfully.');
          setTimeout(() => this.saveMessage.set(''), 3000);
        },
        error: (err) => {
          console.error('Failed to save preferences', err);
          // Extract detailed error message from backend if available
          const detail = err.error?.detail || err.message || 'Failed to save preferences. Please try again.';
          this.saveMessage.set(`Error: ${detail}`);
        }
      });
  }
}
