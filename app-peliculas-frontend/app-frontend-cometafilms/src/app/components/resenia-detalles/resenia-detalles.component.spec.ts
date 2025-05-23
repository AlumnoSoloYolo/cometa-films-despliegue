import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReseniaDetallesComponent } from './resenia-detalles.component';

describe('ReseniaDetallesComponent', () => {
  let component: ReseniaDetallesComponent;
  let fixture: ComponentFixture<ReseniaDetallesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReseniaDetallesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReseniaDetallesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
