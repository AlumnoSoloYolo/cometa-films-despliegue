import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PremiumSuccessComponent } from './premium-success.component';

describe('PremiumSuccessComponent', () => {
  let component: PremiumSuccessComponent;
  let fixture: ComponentFixture<PremiumSuccessComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PremiumSuccessComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PremiumSuccessComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
