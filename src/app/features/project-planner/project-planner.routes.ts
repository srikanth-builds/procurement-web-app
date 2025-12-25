import { Routes } from '@angular/router';

export const PROJECT_PLANNER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => 
      import('./pages/project-planner.page').then(m => m.ProjectPlannerPage),
  }
];
