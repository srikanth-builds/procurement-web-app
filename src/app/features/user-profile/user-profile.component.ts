import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { UserProfileService } from '../../core/services/user-profile.service';

type ProfileSection = 'profile' | 'preferences' | 'memory';

@Component({
    selector: 'app-user-profile',
    standalone: true,
    imports: [CommonModule, LucideAngularModule],
    templateUrl: './user-profile.component.html',
    styleUrl: './user-profile.component.scss'
})
export class UserProfileComponent {
    private userProfileService = inject(UserProfileService);

    activeSection = signal<ProfileSection>('profile');

    userProfile = computed(() => this.userProfileService.userProfileResource.value()?.user_profile);
    isLoading = computed(() => this.userProfileService.userProfileResource.isLoading());
    error = computed(() => this.userProfileService.userProfileResource.error());

    sections: { id: ProfileSection; label: string; icon: string; description: string }[] = [
        { id: 'profile', label: 'Profile', icon: 'user', description: 'Personal and work details' },
        { id: 'preferences', label: 'Preferences', icon: 'settings', description: 'App settings and defaults' },
        { id: 'memory', label: 'Memory', icon: 'brain', description: 'Agent memory and context' }
    ];

    setActiveSection(section: ProfileSection) {
        this.activeSection.set(section);
    }
}
