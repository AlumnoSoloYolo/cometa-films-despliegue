import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListaDetallesComponent } from './lista-detalles.component';

describe('ListaDetallesComponent', () => {
  let component: ListaDetallesComponent;
  let fixture: ComponentFixture<ListaDetallesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListaDetallesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListaDetallesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
