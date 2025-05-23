import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { PeliculaDetallesComponent } from './components/pelicula-detalles/pelicula-detalles.component';
import { CreditoDetallesComponent } from './components/credito-detalles/credito-detalles.component';
import { BusquedaPeliculasComponent } from './components/busqueda-peliculas/busqueda-peliculas.component';
import { RegisterComponent } from './components/register/register.component';
import { AuthGuard, NoAuthGuard } from './shared/guards/auth.guard';
import { LoginComponent } from './components/login/login.component';
import { PerfilComponent } from './components/perfil/perfil.component';
import { UsuariosListaComponent } from './components/lista-usuarios/lista-usuarios.component';
import { ReseniaDetallesComponent } from './components/resenia-detalles/resenia-detalles.component';
import { ListaDetallesComponent } from './components/lista-detalles/lista-detalles.component';
import { NotificacionesComponent } from './components/notificaciones/notificaciones.component';
import { ActivityFeedComponent } from './components/activity-feed/activity-feed.component';
import { PremiumComponent } from './components/premium/premium/premium.component';
import { PremiumSuccessComponent } from './components/premium/premium-success/premium-success.component';
import { PremiumCancelComponent } from './components/premium/premium-cancel/premium-cancel.component';

export const routes: Routes = [

    {
        path: '',
        component: HomeComponent,
        canActivate: [AuthGuard]
    },
    {
        path: 'pelicula/:id',
        component: PeliculaDetallesComponent,
        canActivate: [AuthGuard]
    },
    {
        path: 'persona/:id',
        component: CreditoDetallesComponent,
        canActivate: [AuthGuard]
    },
    {
        path: 'buscador-peliculas',
        component: BusquedaPeliculasComponent,
        canActivate: [AuthGuard]

    },
    {
        path: "registro",
        component: RegisterComponent,
        canActivate: [NoAuthGuard]
    },
    {
        path: "login",
        component: LoginComponent,
        canActivate: [NoAuthGuard]
    },
    {
        path: "perfil",
        component: PerfilComponent,
        canActivate: [AuthGuard]
    },
    {
        path: 'usuarios',
        component: UsuariosListaComponent,
        canActivate: [AuthGuard]
    },

    {
        path: 'usuarios/:id',
        component: PerfilComponent,
        canActivate: [AuthGuard]
    },

    {
        path: 'resenia/:reviewId',
        component: ReseniaDetallesComponent,
        canActivate: [AuthGuard]
    },
    {
        path: 'listas/:id',
        component: ListaDetallesComponent,
        canActivate: [AuthGuard]
    },
    {
        path: 'notificaciones',
        component: NotificacionesComponent,
        canActivate: [AuthGuard]
    },
    {
        path: 'premium',
        component: PremiumComponent,
        canActivate: [AuthGuard]
    },
    {
        path: 'premium/success',
        component: PremiumSuccessComponent,
        canActivate: [AuthGuard]
    },
    {
        path: 'premium/cancel',
        component: PremiumCancelComponent,
        canActivate: [AuthGuard]
    },

    {
        path: 'feed',
        component: ActivityFeedComponent,
        canActivate: [AuthGuard]
    },

    { path: '**', redirectTo: 'login' },



];
