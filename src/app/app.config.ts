import { ApplicationConfig, provideBrowserGlobalErrorListeners, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { LucideAngularModule, Package2, User, ShoppingCart, Users, BarChart, Handshake, FileText, PanelLeft, Bell, Plus, History, PenLine, Check, X, Search, Bot, Trash2, Settings, MessageSquare, ExternalLink, SendHorizontal, Sun, Moon, MoonIcon, SunIcon, ArrowLeft, ArrowRight, ArrowLeftRight, BookOpen, Loader2, MapPin, Star, CheckCircle, Building2, Minus, Sparkle, Sparkles, Download, Image, Clock, MessageCircleQuestionMark, BotIcon, Edit2, PackageCheck, AlertCircle, Brain, Copy, Link,Database } from 'lucide-angular';

import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { provideMarkdown, MARKED_OPTIONS, MarkedOptions } from 'ngx-markdown';

const markedOptions: MarkedOptions = {
  breaks: true,
  gfm: true, // GitHub Flavored Markdown - enables tables
  pedantic: false,
};

const LucideIcons = {
  Package2, User, ShoppingCart, Users, Handshake, FileText, PanelLeft, Bell, Plus, History, PenLine, Check, X, Search, Bot, Trash2, Settings, MessageSquare, SendHorizontal, MoonIcon, SunIcon, ExternalLink, Sun, Moon, ArrowLeft, ArrowRight, ArrowLeftRight, BarChart, BookOpen, Loader2, MapPin, Star,
  CheckCircle,
  Building2,
  Minus,
  Sparkles,
  Download,
  Image,
  Clock,
  BotIcon,
  MessageCircleQuestionMark,
  Edit2,
  PackageCheck,
  AlertCircle,
  Brain,
  Copy,
  Link,
  Database

}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    provideMarkdown({
      markedOptions: {
        provide: MARKED_OPTIONS,
        useValue: markedOptions,
      },
    }),
    importProvidersFrom(LucideAngularModule.pick(LucideIcons))
  ]
};
