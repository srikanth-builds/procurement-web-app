import { Injectable, inject } from '@angular/core';
import { httpResource, HttpClient } from '@angular/common/http';
import { UserProfile, UserProfileResponse } from '../models/user-profile.model';
import { environment } from '../../../environments/environments';

@Injectable({
    providedIn: 'root'
})
export class UserProfileService {
    private http = inject(HttpClient);

    // Resource to fetch user profile
    userProfileResource = httpResource<UserProfileResponse>(() => {
        return {
            url: `${environment.agentUrl}user/profile`,
            method: 'GET',
            headers: {
                'x-user-id': 'EMP-2024-001'
            }
        };
    });

    constructor() { }

    updatePreferences(preferences: Record<string, any>) {
        return this.http.put<UserProfile>(`${environment.agentUrl}user/preferences`, preferences);
    }

    getPreferences() {
        return this.http.get<Record<string, any>>(`${environment.agentUrl}user/preferences`);
    }
}

