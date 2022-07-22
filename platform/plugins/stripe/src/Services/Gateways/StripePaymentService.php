<?php

namespace Botble\Stripe\Services\Gateways;

use Botble\Payment\Enums\PaymentStatusEnum;
use Botble\Payment\Supports\PaymentHelper;
use Botble\RealEstate\Repositories\Interfaces\PackageInterface;
use Botble\Stripe\Services\Abstracts\StripePaymentAbstract;
use Botble\Stripe\Supports\StripeHelper;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Log;
use Stripe\Charge;
use Stripe\Checkout\Session as StripeCheckoutSession;
use Stripe\Exception\ApiErrorException;

class StripePaymentService extends StripePaymentAbstract
{
    /**
     * Make a payment
     *
     * @param Request $request
     *
     * @return mixed
     * @throws ApiErrorException
     */
    public function makePayment(Request $request)
    {
        $this->amount = $request->input('amount');
        $this->currency = $request->input('currency', config('plugins.payment.payment.currency'));
        $this->currency = strtoupper($this->currency);

        $this->setClient();

        if ($this->isStripeApiCharge()) {

            if (!$this->token) {
                $this->setErrorMessage(trans('plugins/payment::payment.could_not_get_stripe_token'));

                Log::error(
                    trans('plugins/payment::payment.could_not_get_stripe_token'),
                    PaymentHelper::formatLog(
                        [
                            'error'         => 'missing Stripe token',
                            'last_4_digits' => $request->input('last4Digits'),
                            'name'          => $request->input('name'),
                            'client_IP'     => $request->input('clientIP'),
                            'time_created'  => $request->input('timeCreated'),
                            'live_mode'     => $request->input('liveMode'),
                        ],
                        __LINE__,
                        __FUNCTION__,
                        __CLASS__
                    )
                );

                return false;
            }

            $charge = Charge::create([
                'amount'      => $this->convertAmount($this->amount),
                'currency'    => $this->currency,
                'source'      => $this->token,
                'description' => trans('plugins/payment::payment.payment_description', [
                    'order_id' => Arr::first((array)$request->input('order_id')),
                    'site_url' => $request->getHost(),
                ]),
                'metadata'    => ['order_id' => json_encode((array)$request->input('order_id'))],
            ]);

            $this->chargeId = $charge['id'];

            if ($this->chargeId) {
                // Hook after made payment
                $this->afterMakePayment($this->chargeId, $request);
            }

            return $this->chargeId;
        }

        $product = app(PackageInterface::class)->findById(session('subscribed_packaged_id'));

        if (!$product) {
            return false;
        }

        $lineItems = [
            [
                'price_data'  => [
                    'product_data' => [
                        'name'     => $product->name,
                        'metadata' => [
                            'pro_id' => $product->id,
                        ],
                    ],
                    'unit_amount'  => $this->convertAmount($this->amount),
                    'currency'     => $this->currency,
                ],
                'quantity'    => 1,
                'description' => $product->name,
            ],
        ];

        $checkoutSession = StripeCheckoutSession::create([
            'line_items'  => $lineItems,
            'mode'        => 'payment',
            'success_url' => route('payments.stripe.success') . '?session_id={CHECKOUT_SESSION_ID}',
            'cancel_url'  => route('payments.stripe.error'),
            'metadata'    => [
                'order_id'      => json_encode((array)$request->input('order_id', [])),
                'amount'        => $this->amount,
                'currency'      => $this->currency,
                'customer_id'   => $request->input('customer_id'),
                'customer_type' => $request->input('customer_type'),
                'return_url'    => $request->input('return_url'),
                'callback_url'  => $request->input('callback_url'),
            ],
        ]);

        return $checkoutSession->url;
    }

    /**
     * @param $amount
     * @return int
     */
    protected function convertAmount($amount): int
    {
        $multiplier = StripeHelper::getStripeCurrencyMultiplier($this->currency);

        if ($multiplier > 1) {
            $amount = (int)(round((float)$amount, 2) * $multiplier);
        } else {
            $amount = (int)$amount;
        }

        return $amount;
    }

    /**
     * Use this function to perform more logic after user has made a payment
     *
     * @param string $chargeId
     * @param Request $request
     *
     * @return string
     */
    public function afterMakePayment($chargeId, Request $request)
    {
        try {
            $payment = $this->getPaymentDetails($chargeId);
            if ($payment && ($payment->paid || $payment->status == 'succeeded')) {
                $paymentStatus = PaymentStatusEnum::COMPLETED;
            } else {
                $paymentStatus = PaymentStatusEnum::FAILED;
            }
        } catch (Exception $exception) {
            $paymentStatus = PaymentStatusEnum::FAILED;
        }

        $orderIds = (array)$request->input('order_id', []);

        do_action(PAYMENT_ACTION_PAYMENT_PROCESSED, [
            'amount'          => $request->input('amount'),
            'currency'        => $request->input('currency'),
            'charge_id'       => $chargeId,
            'order_id'        => $orderIds,
            'customer_id'     => $request->input('customer_id'),
            'customer_type'   => $request->input('customer_type'),
            'payment_channel' => STRIPE_PAYMENT_METHOD_NAME,
            'status'          => $paymentStatus,
        ]);

        return $chargeId;
    }

    /**
     * @return bool
     */
    public function isStripeApiCharge(): bool
    {
        $key = 'stripe_api_charge';

        return get_payment_setting('payment_type', STRIPE_PAYMENT_METHOD_NAME, $key) == $key;
    }
}
