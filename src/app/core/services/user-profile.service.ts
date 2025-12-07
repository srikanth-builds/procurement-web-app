import { Injectable, inject } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { UserProfile, UserProfileResponse } from '../models/user-profile.model';
import { environment } from '../../../environments/environments';

@Injectable({
    providedIn: 'root'
})
export class UserProfileService {

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
}

