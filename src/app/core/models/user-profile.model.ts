export interface UserProfile {
    _id: {
        $oid: string;
    };
    user_id: string;
    employee_id: string;
    name: string;
    email: string;
    role: string;
    job_title: string;
    department: string;
    cost_center: string;
    location: string;
    manager_name: string;
    manager_id: string;
    active: boolean;
    approval_level_tier: number;
    approval_level_limit_usd: number;
    approval_level_can_approve_own: boolean;
    delegated_approver_id: string;
    delegation_valid_from: string;
    delegation_valid_to: string;
    currency_preference: string;
    purchasing_stats_total_spend_ytd: number;
    purchasing_stats_order_count_ytd: number;
    purchasing_stats_avg_order_value: number;
    created_at: string;
    created_by: string;
    last_updated_at: string;
    last_updated_by: string;
}

export interface UserProfileResponse {
    user_profile: UserProfile;
    stats?: any;
}
